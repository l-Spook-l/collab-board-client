import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type PointerEvent,
} from "react";

import {
    BOARD_HEIGHT,
    BOARD_WIDTH,
    createEmptyBoardDocument,
    type BoardDocument,
    type BoardPoint,
    type BoardStroke,
} from "../../model/document";
import type { BoardRealtimeEvent } from "../../realtime/events";

import "./Whiteboard.css";

export interface WhiteboardHandle {
    getDocument: () => BoardDocument;
    loadDocument: (document: BoardDocument) => void;
    applyRemoteEvent: (event: BoardRealtimeEvent) => void;
}

interface WhiteboardProps {
    initialDocument?: BoardDocument;
    disabled?: boolean;
    onRealtimeEvent?: (event: BoardRealtimeEvent) => void;
    onDocumentChange?: () => void;
}

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
    { initialDocument, disabled = false, onRealtimeEvent, onDocumentChange },
    forwardedRef,
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Refs store the current gesture state without making React re-render
    // on every pointer movement.
    const isDrawingRef = useRef(false);
    const activeStrokeRef = useRef<BoardStroke | null>(null);
    const documentRef = useRef<BoardDocument>(createEmptyBoardDocument());

    // Brush settings are only needed by this editor, so they remain local for now.
    const [brushColor, setBrushColor] = useState("#1f2937");
    const [brushSize, setBrushSize] = useState(5);

    // Convert mouse or touch coordinates to canvas coordinates.
    // This keeps the drawing aligned with the pointer when the window is resized.
    const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>): BoardPoint => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();

        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    const drawDot = (context: CanvasRenderingContext2D, stroke: BoardStroke, point: BoardPoint) => {
        context.fillStyle = stroke.color;
        context.beginPath();
        context.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
        context.fill();
    };

    const drawSegment = (
        context: CanvasRenderingContext2D,
        stroke: BoardStroke,
        from: BoardPoint,
        to: BoardPoint,
    ) => {
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.width;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
    };

    const loadDocument = (document: BoardDocument) => {
        documentRef.current = JSON.parse(JSON.stringify(document)) as BoardDocument;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);

        for (const stroke of documentRef.current.strokes) {
            const firstPoint = stroke.points[0];
            if (!firstPoint) continue;
            if (stroke.points.length === 1) {
                drawDot(context, stroke, firstPoint);
                continue;
            }
            for (let index = 1; index < stroke.points.length; index += 1) {
                drawSegment(context, stroke, stroke.points[index - 1], stroke.points[index]);
            }
        }
        activeStrokeRef.current = null;
        isDrawingRef.current = false;
    };

    const getDocument = () =>
        JSON.parse(JSON.stringify(documentRef.current)) as BoardDocument;

    const applyRemoteEvent = (event: BoardRealtimeEvent) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        if (event.type === "canvas:clear") {
            documentRef.current = createEmptyBoardDocument();
            activeStrokeRef.current = null;
            isDrawingRef.current = false;
            context.clearRect(0, 0, canvas.width, canvas.height);
            onDocumentChange?.();
            return;
        }

        if (event.type === "stroke:start") {
            if (documentRef.current.strokes.some((stroke) => stroke.id === event.data.stroke_id)) return;
            const stroke: BoardStroke = {
                id: event.data.stroke_id,
                color: event.data.color,
                width: event.data.width,
                points: [event.data.point],
            };
            documentRef.current.strokes.push(stroke);
            drawDot(context, stroke, event.data.point);
            onDocumentChange?.();
            return;
        }

        if (event.type === "stroke:points") {
            const stroke = documentRef.current.strokes.find(
                (item) => item.id === event.data.stroke_id,
            );
            if (!stroke) return;
            for (const point of event.data.points) {
                const previousPoint = stroke.points[stroke.points.length - 1];
                if (previousPoint) drawSegment(context, stroke, previousPoint, point);
                stroke.points.push(point);
            }
            onDocumentChange?.();
        }
    };

    useImperativeHandle(forwardedRef, () => ({ getDocument, loadDocument, applyRemoteEvent }));

    useEffect(() => {
        if (initialDocument) loadDocument(initialDocument);
    }, [initialDocument]);

    // Start the stroke and capture the pointer so drawing can continue
    // even if it moves slightly beyond the canvas edge.
    const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const canvas = event.currentTarget;
        canvas.setPointerCapture(event.pointerId);

        const point = getCanvasPoint(event);
        isDrawingRef.current = true;
        const stroke: BoardStroke = {
            id: crypto.randomUUID(),
            color: brushColor,
            width: brushSize,
            points: [point],
        };
        activeStrokeRef.current = stroke;
        documentRef.current.strokes.push(stroke);
        const context = canvas.getContext("2d");
        if (context) drawDot(context, stroke, point);
        onRealtimeEvent?.({
            type: "stroke:start",
            data: { stroke_id: stroke.id, color: stroke.color, width: stroke.width, point },
        });
        onDocumentChange?.();
    };

    // Draw a line from the previous pointer position to the current one.
    const draw = (event: PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        const stroke = activeStrokeRef.current;
        if (!isDrawingRef.current || !stroke) return;

        const canvas = event.currentTarget;
        const context = canvas.getContext("2d");

        if (!context) {
            return;
        }

        const nextPoint = getCanvasPoint(event);

        const previousPoint = stroke.points[stroke.points.length - 1];
        if (!previousPoint) return;
        drawSegment(context, stroke, previousPoint, nextPoint);
        stroke.points.push(nextPoint);
        onRealtimeEvent?.({
            type: "stroke:points",
            data: { stroke_id: stroke.id, points: [nextPoint] },
        });
        onDocumentChange?.();
    };

    // Finish the stroke when the button is released or the browser cancels the gesture.
    const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        const stroke = activeStrokeRef.current;
        isDrawingRef.current = false;
        activeStrokeRef.current = null;
        if (stroke) {
            onRealtimeEvent?.({ type: "stroke:end", data: { stroke_id: stroke.id } });
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    // Clear the canvas pixels without changing its size or brush settings.
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        documentRef.current = createEmptyBoardDocument();
        isDrawingRef.current = false;
        activeStrokeRef.current = null;
        onRealtimeEvent?.({ type: "canvas:clear", data: {} });
        onDocumentChange?.();
    };

    return (
        <section className="whiteboard-editor">
            <div className="whiteboard-toolbar">
                <label className="whiteboard-control">
                    Color
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(event) => setBrushColor(event.target.value)}
                    />
                </label>

                <label className="whiteboard-control">
                    Size
                    <input
                        type="range"
                        min="1"
                        max="32"
                        value={brushSize}
                        onChange={(event) => setBrushSize(Number(event.target.value))}
                    />
                    <output>{brushSize}px</output>
                </label>

                <button
                    className="whiteboard-clear-button"
                    type="button"
                    disabled={disabled}
                    onClick={clearCanvas}
                >
                    Clear
                </button>
            </div>

            <div className="whiteboard-workspace">
                <canvas
                    ref={canvasRef}
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    aria-label="Drawing canvas"
                    aria-disabled={disabled}
                    className={`whiteboard-canvas${disabled ? " whiteboard-canvas-disabled" : ""}`}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                />
            </div>
        </section>
    );
});

export default Whiteboard;
