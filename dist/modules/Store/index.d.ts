import { mat3 } from 'gl-matrix';
export declare const ALPHA_MIN = 0.001;
export declare const MAX_POINT_SIZE = 64;
export declare type Hovered<Node> = {
    node: Node;
    index: number;
    position: [number, number];
};
export declare type Focused<Node> = {
    node: Node;
    index: number;
};
export declare class Store<N> {
    pointsTextureSize: number;
    linksTextureSize: number;
    alpha: number;
    transform: mat3;
    backgroundColor: [number, number, number, number];
    screenSize: [number, number];
    mousePosition: number[];
    screenMousePosition: number[];
    selectedArea: number[][];
    isSimulationRunning: boolean;
    simulationProgress: number;
    selectedIndices: Float32Array | null;
    maxPointSize: number;
    hoveredNode: Hovered<N> | undefined;
    focusedNode: Focused<N> | undefined;
    hoveredNodeRingColor: number[];
    focusedNodeRingColor: number[];
    private alphaTarget;
    private scaleNodeX;
    private scaleNodeY;
    private random;
    addRandomSeed(seed: number | string): void;
    getRandomFloat(min: number, max: number): number;
    updateScreenSize(width: number, height: number, spaceSize: number): void;
    scaleX(x: number): number;
    scaleY(y: number): number;
    setHighlightedNodeRingColor(color: string): void;
    setFocusedNode(node?: N, index?: number): void;
    addAlpha(decay: number): number;
    private alphaDecay;
}
