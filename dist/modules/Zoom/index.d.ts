import { ZoomTransform } from 'd3-zoom';
import { Store } from "../Store";
import { GraphConfigInterface } from "../../config";
import { CosmosInputNode, CosmosInputLink } from "../../types";
export declare class Zoom<N extends CosmosInputNode, L extends CosmosInputLink> {
    readonly store: Store<N>;
    readonly config: GraphConfigInterface<N, L>;
    eventTransform: ZoomTransform;
    behavior: import("d3-zoom").ZoomBehavior<HTMLCanvasElement, undefined>;
    isRunning: boolean;
    constructor(store: Store<N>, config: GraphConfigInterface<N, L>);
    getTransform(positions: [number, number][], scale?: number): ZoomTransform;
    getDistanceToPoint(position: [number, number]): number;
    getMiddlePointTransform(position: [number, number]): ZoomTransform;
    convertSpaceToScreenPosition(spacePosition: [number, number]): [number, number];
    convertSpaceToScreenRadius(spaceRadius: number): number;
}
