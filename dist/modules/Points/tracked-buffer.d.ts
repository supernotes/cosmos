import regl from 'regl';
export declare function createTrackedPositionsBuffer(indices: number[], reglInstance: regl.Regl): regl.Framebuffer2D;
export declare function createTrackedIndicesBuffer(indices: number[], pointsTextureSize: number, reglInstance: regl.Regl): regl.Framebuffer2D;
