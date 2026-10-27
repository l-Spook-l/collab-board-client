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

type ShapeTool = "line" | "arrow" | "rectangle" | "ellipse";
type DrawingTool = "pen" | ShapeTool | "eraser";

type ActiveGesture =
    | { type: "freehand"; stroke: BoardStroke }
    | {
        type: "shape";
        tool: ShapeTool;
        id: string;
        color: string;
        width: number;
        start: BoardPoint;
        end: BoardPoint;
    };

const MAX_POINTS_PER_EVENT = 256;
const SHAPE_SEGMENTS = 48;
const ERASER_COLOR = "#ffffff";

const drawingTools: { id: DrawingTool; label: string }[] = [
    { id: "pen", label: "Pen" },
    { id: "line", label: "Line" },
    { id: "arrow", label: "Arrow" },
    { id: "rectangle", label: "Rectangle" },
    { id: "ellipse", label: "Ellipse" },
    { id: "eraser", label: "Eraser" },
];

function isShapeTool(tool: DrawingTool): tool is ShapeTool {
    return tool !== "pen" && tool !== "eraser";
}

function clampCanvasPoint(point: BoardPoint): BoardPoint {
    return {
        x: Math.max(0, Math.min(BOARD_WIDTH, point.x)),
        y: Math.max(0, Math.min(BOARD_HEIGHT, point.y)),
    };
}

function createShapePoints(
    tool: ShapeTool,
    start: BoardPoint,
    end: BoardPoint,
): BoardPoint[] {
    if (start.x === end.x && start.y === end.y) return [start];
    if (tool === "line") return [start, end];

    if (tool === "arrow") {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);
        if (length === 0) return [start];

        const angle = Math.atan2(dy, dx);
        const headLength = Math.min(24, length * 0.4);
        const wingAngle = Math.PI / 6;
        return [
            start,
            end,
            {
                x: end.x - headLength * Math.cos(angle - wingAngle),
                y: end.y - headLength * Math.sin(angle - wingAngle),
            },
            end,
            {
                x: end.x - headLength * Math.cos(angle + wingAngle),
                y: end.y - headLength * Math.sin(angle + wingAngle),
            },
        ].map(clampCanvasPoint);
    }

    if (tool === "rectangle") {
        return [
            start,
            { x: end.x, y: start.y },
            end,
            { x: start.x, y: end.y },
            start,
        ].map(clampCanvasPoint);
    }

    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    if (radiusX === 0 && radiusY === 0) return [start];
    if (radiusX === 0 || radiusY === 0) return [start, end];

    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    return Array.from({ length: SHAPE_SEGMENTS + 1 }, (_, index) => {
        const angle = (index / SHAPE_SEGMENTS) * Math.PI * 2;
        return clampCanvasPoint({
            x: centerX + radiusX * Math.cos(angle),
            y: centerY + radiusY * Math.sin(angle),
        });
    });
}

function drawDot(context: CanvasRenderingContext2D, stroke: BoardStroke, point: BoardPoint) {
    const previousCompositeOperation = context.globalCompositeOperation;
    context.globalCompositeOperation = isEraserStroke(stroke) ? "destination-out" : "source-over";
    context.fillStyle = stroke.color;
    context.beginPath();
    context.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = previousCompositeOperation;
}

function drawSegment(
    context: CanvasRenderingContext2D,
    stroke: BoardStroke,
    from: BoardPoint,
    to: BoardPoint,
) {
    const previousCompositeOperation = context.globalCompositeOperation;
    context.globalCompositeOperation = isEraserStroke(stroke) ? "destination-out" : "source-over";
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.globalCompositeOperation = previousCompositeOperation;
}

function isEraserStroke(stroke: BoardStroke): boolean {
    // Legacy boards stored eraser marks as white strokes, including records that
    // were later normalized to is_eraser: false by the API schema.
    return stroke.is_eraser === true || stroke.color.toLowerCase() === ERASER_COLOR;
}

function drawStroke(context: CanvasRenderingContext2D, stroke: BoardStroke) {
    const firstPoint = stroke.points[0];
    if (!firstPoint) return;
    if (stroke.points.length === 1) {
        drawDot(context, stroke, firstPoint);
        return;
    }
    for (let index = 1; index < stroke.points.length; index += 1) {
        drawSegment(context, stroke, stroke.points[index - 1], stroke.points[index]);
    }
}

const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
    { initialDocument, disabled = false, onRealtimeEvent, onDocumentChange },
    forwardedRef,
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const eraserCursorRef = useRef<HTMLDivElement>(null);

    // Gesture refs avoid a React render for every pointer movement.
    const activeGestureRef = useRef<ActiveGesture | null>(null);
    const documentRef = useRef<BoardDocument>(createEmptyBoardDocument());

    // Tool and brush settings belong to this editor and aren't part of the board document.
    const [activeTool, setActiveTool] = useState<DrawingTool>("pen");
    const [brushColor, setBrushColor] = useState("#1f2937");
    const [brushSize, setBrushSize] = useState(5);
    const [showGrid, setShowGrid] = useState(false);

    const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>): BoardPoint => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();

        return clampCanvasPoint({
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        });
    };

    const hideEraserCursor = () => {
        if (eraserCursorRef.current) {
            eraserCursorRef.current.style.display = "none";
        }
    };

    const updateEraserCursor = (event: PointerEvent<HTMLCanvasElement>) => {
        const cursor = eraserCursorRef.current;
        if (!cursor || disabled || activeTool !== "eraser") {
            hideEraserCursor();
            return;
        }

        const canvas = event.currentTarget;
        const point = getCanvasPoint(event);
        const diameter = Math.max(
            1,
            (brushSize * canvas.getBoundingClientRect().width) / canvas.width,
        );
        cursor.style.left = `${(point.x / BOARD_WIDTH) * 100}%`;
        cursor.style.top = `${(point.y / BOARD_HEIGHT) * 100}%`;
        cursor.style.width = `${diameter}px`;
        cursor.style.height = `${diameter}px`;
        cursor.style.display = "block";
    };

    const redrawDocument = (preview?: BoardStroke) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of documentRef.current.strokes) drawStroke(context, stroke);
        if (preview) drawStroke(context, preview);
    };

    const loadDocument = (document: BoardDocument) => {
        documentRef.current = JSON.parse(JSON.stringify(document)) as BoardDocument;
        activeGestureRef.current = null;
        redrawDocument();
    };

    const getDocument = () =>
        JSON.parse(JSON.stringify(documentRef.current)) as BoardDocument;

    const applyRemoteEvent = (event: BoardRealtimeEvent) => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        if (event.type === "canvas:clear") {
            documentRef.current = createEmptyBoardDocument();
            activeGestureRef.current = null;
            redrawDocument();
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
                is_eraser: event.data.is_eraser,
            };
            documentRef.current.strokes.push(stroke);
            drawStroke(context, stroke);
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

    useEffect(() => {
        if (disabled || activeTool !== "eraser") hideEraserCursor();
    }, [activeTool, disabled]);

    const publishStroke = (stroke: BoardStroke) => {
        const firstPoint = stroke.points[0];
        if (!firstPoint) return;

        onRealtimeEvent?.({
            type: "stroke:start",
            data: {
                stroke_id: stroke.id,
                color: stroke.color,
                width: stroke.width,
                point: firstPoint,
                is_eraser: stroke.is_eraser,
            },
        });
        for (let offset = 1; offset < stroke.points.length; offset += MAX_POINTS_PER_EVENT) {
            onRealtimeEvent?.({
                type: "stroke:points",
                data: {
                    stroke_id: stroke.id,
                    points: stroke.points.slice(offset, offset + MAX_POINTS_PER_EVENT),
                },
            });
        }
        onRealtimeEvent?.({ type: "stroke:end", data: { stroke_id: stroke.id } });
    };

    // Capture the pointer so the gesture can finish at the canvas edge.
    const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        if (disabled) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (activeGestureRef.current) return;
        updateEraserCursor(event);

        const canvas = event.currentTarget;
        canvas.setPointerCapture(event.pointerId);

        const point = getCanvasPoint(event);
        if (isShapeTool(activeTool)) {
            const gesture: ActiveGesture = {
                type: "shape",
                tool: activeTool,
                id: crypto.randomUUID(),
                color: brushColor,
                width: brushSize,
                start: point,
                end: point,
            };
            activeGestureRef.current = gesture;
            redrawDocument({
                id: gesture.id,
                color: gesture.color,
                width: gesture.width,
                points: createShapePoints(gesture.tool, gesture.start, gesture.end),
                is_eraser: false,
            });
            return;
        }

        const stroke: BoardStroke = {
            id: crypto.randomUUID(),
            color: activeTool === "eraser" ? ERASER_COLOR : brushColor,
            width: brushSize,
            points: [point],
            is_eraser: activeTool === "eraser",
        };
        activeGestureRef.current = { type: "freehand", stroke };
        documentRef.current.strokes.push(stroke);
        const context = canvas.getContext("2d");
        if (context) drawStroke(context, stroke);
        onRealtimeEvent?.({
            type: "stroke:start",
            data: {
                stroke_id: stroke.id,
                color: stroke.color,
                width: stroke.width,
                point,
                is_eraser: stroke.is_eraser,
            },
        });
        onDocumentChange?.();
    };

    const draw = (event: PointerEvent<HTMLCanvasElement>) => {
        updateEraserCursor(event);
        if (disabled) return;
        const gesture = activeGestureRef.current;
        if (!gesture) return;

        const canvas = event.currentTarget;
        const context = canvas.getContext("2d");
        if (!context) return;

        const nextPoint = getCanvasPoint(event);
        if (gesture.type === "shape") {
            gesture.end = nextPoint;
            redrawDocument({
                id: gesture.id,
                color: gesture.color,
                width: gesture.width,
                points: createShapePoints(gesture.tool, gesture.start, gesture.end),
                is_eraser: false,
            });
            return;
        }

        const stroke = gesture.stroke;
        const previousPoint = stroke.points[stroke.points.length - 1];
        if (!previousPoint) return;
        if (previousPoint.x === nextPoint.x && previousPoint.y === nextPoint.y) return;
        drawSegment(context, stroke, previousPoint, nextPoint);
        stroke.points.push(nextPoint);
        onRealtimeEvent?.({
            type: "stroke:points",
            data: { stroke_id: stroke.id, points: [nextPoint] },
        });
        onDocumentChange?.();
    };

    const releasePointer = (event: PointerEvent<HTMLCanvasElement>) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    const finishDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        const gesture = activeGestureRef.current;
        activeGestureRef.current = null;
        if (!gesture) {
            releasePointer(event);
            return;
        }

        if (gesture.type === "freehand") {
            onRealtimeEvent?.({
                type: "stroke:end",
                data: { stroke_id: gesture.stroke.id },
            });
        } else {
            const stroke: BoardStroke = {
                id: gesture.id,
                color: gesture.color,
                width: gesture.width,
                points: createShapePoints(gesture.tool, gesture.start, getCanvasPoint(event)),
                is_eraser: false,
            };
            documentRef.current.strokes.push(stroke);
            redrawDocument();
            publishStroke(stroke);
            onDocumentChange?.();
        }
        releasePointer(event);
    };

    const cancelDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        const gesture = activeGestureRef.current;
        activeGestureRef.current = null;
        if (gesture?.type === "freehand") {
            onRealtimeEvent?.({
                type: "stroke:end",
                data: { stroke_id: gesture.stroke.id },
            });
        } else if (gesture?.type === "shape") {
            redrawDocument();
        }
        releasePointer(event);
    };

    // Clear the canvas pixels without changing its size or brush settings.
    const clearCanvas = () => {
        documentRef.current = createEmptyBoardDocument();
        activeGestureRef.current = null;
        redrawDocument();
        onRealtimeEvent?.({ type: "canvas:clear", data: {} });
        onDocumentChange?.();
    };

    return (
        <section className="whiteboard-editor">
            <div className="whiteboard-toolbar">
                <div className="whiteboard-tools" role="group" aria-label="Drawing tools">
                    {drawingTools.map((tool) => (
                        <button
                            key={tool.id}
                            className="whiteboard-tool-button"
                            type="button"
                            aria-pressed={activeTool === tool.id}
                            disabled={disabled}
                            onClick={() => setActiveTool(tool.id)}
                        >
                            {tool.label}
                        </button>
                    ))}
                </div>

                <label className="whiteboard-control">
                    Color
                    <input
                        type="color"
                        value={brushColor}
                        disabled={disabled}
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
                        disabled={disabled}
                        onChange={(event) => setBrushSize(Number(event.target.value))}
                    />
                    <output>{brushSize}px</output>
                </label>

                <button
                    className="whiteboard-grid-button"
                    type="button"
                    aria-pressed={showGrid}
                    onClick={() => setShowGrid((current) => !current)}
                >
                    Grid
                </button>

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
                <div className="whiteboard-canvas-frame">
                    <canvas
                        ref={canvasRef}
                        width={BOARD_WIDTH}
                        height={BOARD_HEIGHT}
                        aria-label="Drawing canvas"
                        aria-disabled={disabled}
                        className={`whiteboard-canvas${showGrid ? " whiteboard-canvas-grid" : ""}${activeTool === "eraser" ? " whiteboard-canvas-eraser" : ""}${disabled ? " whiteboard-canvas-disabled" : ""}`}
                        onPointerDown={startDrawing}
                        onPointerMove={draw}
                        onPointerEnter={updateEraserCursor}
                        onPointerLeave={hideEraserCursor}
                        onPointerUp={finishDrawing}
                        onPointerCancel={cancelDrawing}
                    />
                    <div
                        ref={eraserCursorRef}
                        className="whiteboard-eraser-cursor"
                        aria-hidden="true"
                    />
                </div>
            </div>
        </section>
    );
});

export default Whiteboard;
