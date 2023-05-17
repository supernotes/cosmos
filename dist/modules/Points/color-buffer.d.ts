import regl from 'regl';
import { ColorAccessor } from "../../config";
import { CosmosInputNode, CosmosInputLink } from "../../types";
import { GraphData } from "../GraphData";
export declare function createColorBuffer<N extends CosmosInputNode, L extends CosmosInputLink>(data: GraphData<N, L>, reglInstance: regl.Regl, textureSize: number, colorAccessor: ColorAccessor<N>): regl.Framebuffer2D;
export declare function createGreyoutStatusBuffer(selectedIndices: Float32Array | null, reglInstance: regl.Regl, textureSize: number): regl.Framebuffer2D;
