import 'd3-transition';
import { GraphConfig, GraphConfigInterface } from "./config";
import { CosmosInputNode, CosmosInputLink } from "./types";
export declare class Graph<N extends CosmosInputNode, L extends CosmosInputLink> {
    config: GraphConfig<N, L>;
    private canvas;
    private canvasD3Selection;
    private reglInstance;
    private requestAnimationFrameId;
    private isRightClickMouse;
    private graph;
    private store;
    private points;
    private lines;
    private forceGravity;
    private forceCenter;
    private forceManyBody;
    private forceLinkIncoming;
    private forceLinkOutgoing;
    private forceMouse;
    private zoomInstance;
    private fpsMonitor;
    private hasBeenRecentlyDestroyed;
    private currentEvent;
    constructor(canvas: HTMLCanvasElement, config?: GraphConfigInterface<N, L>);
    get progress(): number;
    /**
     * A value that gives information about the running simulation status.
     */
    get isSimulationRunning(): boolean;
    /**
     * The maximum point size.
     * This value is the maximum size of the `gl.POINTS` primitive that WebGL can render on the user's hardware.
     */
    get maxPointSize(): number;
    /**
     * Set or update Cosmos configuration. The changes will be applied in real time.
     * @param config Cosmos configuration object.
     */
    setConfig(config: Partial<GraphConfigInterface<N, L>>): void;
    /**
     * Pass data to Cosmos.
     * @param nodes Array of nodes.
     * @param links Array of links.
     * @param runSimulation When set to `false`, the simulation won't be started automatically (`true` by default).
     */
    setData(nodes: N[], links: L[], runSimulation?: boolean): void;
    /**
     * Center the view on a node and zoom in, by node id.
     * @param id Id of the node.
     * @param duration Duration of the animation transition in milliseconds (`700` by default).
     * @param scale Scale value to zoom in or out (`3` by default).
     * @param canZoomOut Set to `false` to prevent zooming out from the node (`true` by default).
     */
    zoomToNodeById(id: string, duration?: number, scale?: number, canZoomOut?: boolean): void;
    /**
     * Center the view on a node and zoom in, by node index.
     * @param index The index of the node in the array of nodes.
     * @param duration Duration of the animation transition in milliseconds (`700` by default).
     * @param scale Scale value to zoom in or out (`3` by default).
     * @param canZoomOut Set to `false` to prevent zooming out from the node (`true` by default).
     */
    zoomToNodeByIndex(index: number, duration?: number, scale?: number, canZoomOut?: boolean): void;
    /**
     * Zoom the view in or out to the specified zoom level.
     * @param value Zoom level
     * @param duration Duration of the zoom in/out transition.
     */
    zoom(value: number, duration?: number): void;
    /**
     * Zoom the view in or out to the specified zoom level.
     * @param value Zoom level
     * @param duration Duration of the zoom in/out transition.
     */
    setZoomLevel(value: number, duration?: number): void;
    /**
     * Get zoom level.
     * @returns Zoom level value of the view.
     */
    getZoomLevel(): number;
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns Object where keys are the ids of the nodes and values are corresponding `{ x: number; y: number }` objects.
     */
    getNodePositions(): {
        [key: string]: {
            x: number;
            y: number;
        };
    };
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns A Map object where keys are the ids of the nodes and values are their corresponding X and Y coordinates in the [number, number] format.
     */
    getNodePositionsMap(): Map<string, [number, number]>;
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns Array of `[x: number, y: number]` arrays.
     */
    getNodePositionsArray(): [number, number][];
    /**
     * Center and zoom in/out the view to fit all nodes in the scene.
     * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
     */
    fitView(duration?: number): void;
    /**
     * Center and zoom in/out the view to fit nodes by their ids in the scene.
     * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
     */
    fitViewByNodeIds(ids: string[], duration?: number): void;
    /** Select nodes inside a rectangular area.
     * @param selection - Array of two corner points `[[left, top], [right, bottom]]`.
     * The `left` and `right` coordinates should be from 0 to the width of the canvas.
     * The `top` and `bottom` coordinates should be from 0 to the height of the canvas. */
    selectNodesInRange(selection: [[number, number], [number, number]] | null): void;
    /**
     * Select a node by id. If you want the adjacent nodes to get selected too, provide `true` as the second argument.
     * @param id Id of the node.
     * @param selectAdjacentNodes When set to `true`, selects adjacent nodes (`false` by default).
     */
    selectNodeById(id: string, selectAdjacentNodes?: boolean): void;
    /**
     * Select a node by index. If you want the adjacent nodes to get selected too, provide `true` as the second argument.
     * @param index The index of the node in the array of nodes.
     * @param selectAdjacentNodes When set to `true`, selects adjacent nodes (`false` by default).
     */
    selectNodeByIndex(index: number, selectAdjacentNodes?: boolean): void;
    /**
     * Select multiples nodes by their ids.
     * @param ids Array of nodes ids.
     */
    selectNodesByIds(ids?: (string | undefined)[] | null, focusedNodeId?: string): void;
    /**
     * Select multiples nodes by their indices.
     * @param indices Array of nodes indices.
     */
    selectNodesByIndices(indices?: (number | undefined)[] | null, focusedNodeIndex?: number): void;
    /**
     * Unselect all nodes.
     */
    unselectNodes(): void;
    /**
     * Get nodes that are currently selected.
     * @returns Array of selected nodes.
     */
    getSelectedNodes(): N[] | null;
    /**
     * Get nodes that are adjacent to a specific node by its id.
     * @param id Id of the node.
     * @returns Array of adjacent nodes.
     */
    getAdjacentNodes(id: string): N[] | undefined;
    /**
     * Converts the X and Y node coordinates from the space coordinate system to the screen coordinate system.
     * @param spacePosition Array of x and y coordinates in the space coordinate system.
     * @returns Array of x and y coordinates in the screen coordinate system.
     */
    spaceToScreenPosition(spacePosition: [number, number]): [number, number];
    /**
     * Converts the node radius value from the space coordinate system to the screen coordinate system.
     * @param spaceRadius Radius of Node in the space coordinate system.
     * @returns Radius of Node in the screen coordinate system.
     */
    spaceToScreenRadius(spaceRadius: number): number;
    /**
     * Get node radius by its index.
     * @param index Index of the node.
     * @returns Radius of the node.
     */
    getNodeRadiusByIndex(index: number): number | undefined;
    /**
     * Get node radius by its id.
     * @param id Id of the node.
     * @returns Radius of the node.
     */
    getNodeRadiusById(id: string): number | undefined;
    /**
     * Track multiple node positions by their ids on each Cosmos tick.
     * @param ids Array of nodes ids.
     */
    trackNodePositionsByIds(ids: string[]): void;
    /**
     * Track multiple node positions by their indices on each Cosmos tick.
     * @param ids Array of nodes indices.
     */
    trackNodePositionsByIndices(indices: number[]): void;
    /**
     * Get current X and Y coordinates of the tracked nodes.
     * @returns A Map object where keys are the ids of the nodes and values are their corresponding X and Y coordinates in the [number, number] format.
     */
    getTrackedNodePositionsMap(): Map<string, [number, number]>;
    /**
     * Start the simulation.
     * @param alpha Value from 0 to 1. The higher the value, the more initial energy the simulation will get.
     */
    start(alpha?: number): void;
    /**
     * Pause the simulation.
     */
    pause(): void;
    /**
     * Restart the simulation.
     */
    restart(): void;
    /**
     * Render only one frame of the simulation (stops the simulation if it was running).
     */
    step(): void;
    /**
     * Destroy this Cosmos instance.
     */
    destroy(): void;
    /**
     * Create new Cosmos instance.
     */
    create(): void;
    private update;
    private initPrograms;
    private frame;
    private stopFrames;
    private end;
    private onClick;
    private updateMousePosition;
    private onMouseMove;
    private onRightClickMouse;
    private resizeCanvas;
    private setZoomTransformByNodePositions;
    private zoomToNode;
    private findHoveredPoint;
}
export type { CosmosInputNode, CosmosInputLink, InputNode, InputLink } from './types';
export type { GraphConfigInterface, GraphEvents, GraphSimulationSettings } from './config';
