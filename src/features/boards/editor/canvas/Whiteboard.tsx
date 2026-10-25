import { useRef, useState, type PointerEvent } from "react";

import "./Whiteboard.css";

interface Point {
    x: number;
    y: number;
}

// Размер внутреннего холста. Он остаётся чётким, даже когда отображается меньше.
const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 950;

function Whiteboard() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Refs хранят состояние текущего жеста, не заставляя React перерисовываться
    // при каждом движении указателя.
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<Point | null>(null);

    // Настройки кисти нужны только этому редактору, поэтому пока они локальные.
    const [brushColor, setBrushColor] = useState("#1f2937");
    const [brushSize, setBrushSize] = useState(5);

    // Переводим координаты мыши или пальца в координаты самого canvas.
    // Так рисунок совпадает с указателем и при изменении размера окна.
    const getCanvasPoint = (
        event: PointerEvent<HTMLCanvasElement>,
    ): Point => {
        const canvas = event.currentTarget;
        const rect = canvas.getBoundingClientRect();

        return {
            x: ((event.clientX - rect.left) / rect.width) * canvas.width,
            y: ((event.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    // Начинаем штрих и захватываем указатель, чтобы продолжить рисовать,
    // даже если он немного выйдет за край холста.
    const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        const canvas = event.currentTarget;
        canvas.setPointerCapture(event.pointerId);

        const point = getCanvasPoint(event);
        const context = canvas.getContext("2d");

        isDrawingRef.current = true;
        lastPointRef.current = point;

        // Ставим точку, чтобы короткое нажатие тоже оставляло след.
        if (context) {
            context.fillStyle = brushColor;
            context.beginPath();
            context.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
            context.fill();
        }
    };

    // Рисуем линию от предыдущего положения указателя к текущему.
    const draw = (event: PointerEvent<HTMLCanvasElement>) => {
        const previousPoint = lastPointRef.current;

        if (!isDrawingRef.current || !previousPoint) {
            return;
        }

        const canvas = event.currentTarget;
        const context = canvas.getContext("2d");

        if (!context) {
            return;
        }

        const nextPoint = getCanvasPoint(event);

        context.strokeStyle = brushColor;
        context.lineWidth = brushSize;
        context.lineCap = "round";
        context.lineJoin = "round";

        context.beginPath();
        context.moveTo(previousPoint.x, previousPoint.y);
        context.lineTo(nextPoint.x, nextPoint.y);
        context.stroke();

        lastPointRef.current = nextPoint;
    };

    // Завершаем штрих при отпускании кнопки или отмене жеста браузером.
    const stopDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
        isDrawingRef.current = false;
        lastPointRef.current = null;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    };

    // Очищаем пиксели холста, не меняя его размер и настройки кисти.
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) {
            return;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        isDrawingRef.current = false;
        lastPointRef.current = null;
    };

    return (
        <section className="whiteboard-editor">
            <div className="whiteboard-toolbar">
                <label className="whiteboard-control">
                    Цвет
                    <input
                        type="color"
                        value={brushColor}
                        onChange={(event) => setBrushColor(event.target.value)}
                    />
                </label>

                <label className="whiteboard-control">
                    Толщина
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
                    onClick={clearCanvas}
                >
                    Очистить
                </button>
            </div>

            <div className="whiteboard-workspace">
                <canvas
                    ref={canvasRef}
                    className="whiteboard-canvas"
                    width={BOARD_WIDTH}
                    height={BOARD_HEIGHT}
                    aria-label="Холст для рисования"
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
                />
            </div>
        </section>
    );
}

export default Whiteboard;