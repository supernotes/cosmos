import { select } from 'd3-selection';
import 'd3-transition';
import { easeQuadInOut, easeQuadIn, easeQuadOut } from 'd3-ease';
import regl from 'regl';
import { color } from 'd3-color';
import { scaleLinear } from 'd3-scale';
import { mat3 } from 'gl-matrix';
import { Random } from 'random';
import { zoomIdentity, zoom } from 'd3-zoom';
import { extent } from 'd3-array';

const isFunction = (a) => typeof a === 'function';
const isArray = (a) => Array.isArray(a);
const isObject = (a) => (a instanceof Object);
const isAClassInstance = (a) => {
    if (a instanceof Object) {
        // eslint-disable-next-line @typescript-eslint/ban-types
        return a.constructor.name !== 'Function' && a.constructor.name !== 'Object';
    }
    else
        return false;
};
const isPlainObject = (a) => isObject(a) && !isArray(a) && !isFunction(a) && !isAClassInstance(a);
function getValue(d, accessor, index) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    if (isFunction(accessor))
        return accessor(d, index);
    else
        return accessor;
}
function getRgbaColor(value) {
    var _a;
    let rgba;
    if (isArray(value)) {
        rgba = value;
    }
    else {
        const color$1 = color(value);
        const rgb = color$1 === null || color$1 === void 0 ? void 0 : color$1.rgb();
        rgba = [(rgb === null || rgb === void 0 ? void 0 : rgb.r) || 0, (rgb === null || rgb === void 0 ? void 0 : rgb.g) || 0, (rgb === null || rgb === void 0 ? void 0 : rgb.b) || 0, (_a = color$1 === null || color$1 === void 0 ? void 0 : color$1.opacity) !== null && _a !== void 0 ? _a : 1];
    }
    return [
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
        rgba[3],
    ];
}
function readPixels(reglInstance, fbo) {
    let resultPixels = new Float32Array();
    reglInstance({ framebuffer: fbo })(() => {
        resultPixels = reglInstance.read();
    });
    return resultPixels;
}
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

const defaultNodeColor = '#b3b3b3';
const defaultGreyoutNodeOpacity = 0.1;
const defaultNodeSize = 4;
const defaultLinkColor = '#666666';
const defaultGreyoutLinkOpacity = 0.1;
const defaultLinkWidth = 1;
const defaultBackgroundColor = '#222222';
const defaultConfigValues = {
    spaceSize: 4096,
    nodeSizeScale: 1,
    linkWidthScale: 1,
    arrowSizeScale: 1,
    renderLinks: true,
    arrowLinks: true,
    linkVisibilityDistanceRange: [50, 150],
    linkVisibilityMinTransparency: 0.25,
    useQuadtree: false,
    simulation: {
        decay: 1000,
        gravity: 0,
        center: 0,
        repulsion: 0.1,
        repulsionTheta: 1.7,
        repulsionQuadtreeLevels: 12,
        linkSpring: 1,
        linkDistance: 2,
        linkDistRandomVariationRange: [1, 1.2],
        repulsionFromMouse: 2,
        friction: 0.85,
    },
    showFPSMonitor: false,
    pixelRatio: 2,
    scaleNodesOnZoom: true,
};
const hoveredNodeRingOpacity = 0.7;
const focusedNodeRingOpacity = 0.95;
const defaultScaleToZoom = 3;

class GraphConfig {
    constructor() {
        this.backgroundColor = defaultBackgroundColor;
        this.spaceSize = defaultConfigValues.spaceSize;
        this.nodeColor = defaultNodeColor;
        this.nodeGreyoutOpacity = defaultGreyoutNodeOpacity;
        this.nodeSize = defaultNodeSize;
        this.nodeSizeScale = defaultConfigValues.nodeSizeScale;
        this.renderHighlightedNodeRing = true;
        this.highlightedNodeRingColor = undefined;
        this.linkColor = defaultLinkColor;
        this.linkGreyoutOpacity = defaultGreyoutLinkOpacity;
        this.linkWidth = defaultLinkWidth;
        this.linkWidthScale = defaultConfigValues.linkWidthScale;
        this.renderLinks = defaultConfigValues.renderLinks;
        this.linkArrows = defaultConfigValues.arrowLinks;
        this.linkArrowsSizeScale = defaultConfigValues.arrowSizeScale;
        this.linkVisibilityDistanceRange = defaultConfigValues.linkVisibilityDistanceRange;
        this.linkVisibilityMinTransparency = defaultConfigValues.linkVisibilityMinTransparency;
        this.useQuadtree = defaultConfigValues.useQuadtree;
        this.simulation = {
            decay: defaultConfigValues.simulation.decay,
            gravity: defaultConfigValues.simulation.gravity,
            center: defaultConfigValues.simulation.center,
            repulsion: defaultConfigValues.simulation.repulsion,
            repulsionTheta: defaultConfigValues.simulation.repulsionTheta,
            repulsionQuadtreeLevels: defaultConfigValues.simulation.repulsionQuadtreeLevels,
            linkSpring: defaultConfigValues.simulation.linkSpring,
            linkDistance: defaultConfigValues.simulation.linkDistance,
            linkDistRandomVariationRange: defaultConfigValues.simulation.linkDistRandomVariationRange,
            repulsionFromMouse: defaultConfigValues.simulation.repulsionFromMouse,
            friction: defaultConfigValues.simulation.friction,
            onStart: undefined,
            onTick: undefined,
            onEnd: undefined,
            onPause: undefined,
            onRestart: undefined,
        };
        this.events = {
            onClick: undefined,
            onMouseMove: undefined,
            onNodeMouseOver: undefined,
            onNodeMouseOut: undefined,
            onZoomStart: undefined,
            onZoom: undefined,
            onZoomEnd: undefined,
        };
        this.showFPSMonitor = defaultConfigValues.showFPSMonitor;
        this.pixelRatio = defaultConfigValues.pixelRatio;
        this.scaleNodesOnZoom = defaultConfigValues.scaleNodesOnZoom;
        this.randomSeed = undefined;
    }
    init(config) {
        Object.keys(config)
            .forEach(configParameter => {
            this.deepMergeConfig(this.getConfig(), config, configParameter);
        });
    }
    deepMergeConfig(current, next, key) {
        if (isPlainObject(current[key]) && isPlainObject(next[key])) {
            // eslint-disable-next-line @typescript-eslint/ban-types
            Object.keys(next[key])
                .forEach(configParameter => {
                this.deepMergeConfig(current[key], next[key], configParameter);
            });
        }
        else
            current[key] = next[key];
    }
    getConfig() {
        return this;
    }
}

class CoreModule {
    constructor(reglInstance, config, store, data, points) {
        this.reglInstance = reglInstance;
        this.config = config;
        this.store = store;
        this.data = data;
        if (points)
            this.points = points;
    }
}

var calculateCentermassFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nvarying vec4 rgba;void main(){gl_FragColor=rgba;}"; // eslint-disable-line

var calculateCentermassVert = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform float pointsTextureSize;attribute vec2 indexes;varying vec4 rgba;void main(){vec4 pointPosition=texture2D(position,indexes/pointsTextureSize);rgba=vec4(pointPosition.xy,1.0,0.0);gl_Position=vec4(0.0,0.0,0.0,1.0);gl_PointSize=1.0;}"; // eslint-disable-line

var forceFrag$5 = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D centermass;uniform float center;uniform float alpha;varying vec2 index;void main(){vec4 pointPosition=texture2D(position,index);vec4 velocity=vec4(0.0);vec4 centermassValues=texture2D(centermass,vec2(0.0));vec2 centermassPosition=centermassValues.xy/centermassValues.b;vec2 distVector=centermassPosition-pointPosition.xy;float dist=sqrt(dot(distVector,distVector));if(dist>0.0){float angle=atan(distVector.y,distVector.x);float addV=alpha*center*dist*0.01;velocity.rg+=addV*vec2(cos(angle),sin(angle));}gl_FragColor=velocity;}"; // eslint-disable-line

function createQuadBuffer(reglInstance) {
    const quadBuffer = reglInstance.buffer(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    return {
        buffer: quadBuffer,
        size: 2,
    };
}
function createIndexesBuffer(reglInstance, textureSize) {
    const indexes = new Float32Array(textureSize * textureSize * 2);
    for (let y = 0; y < textureSize; y++) {
        for (let x = 0; x < textureSize; x++) {
            const i = y * textureSize * 2 + x * 2;
            indexes[i + 0] = x;
            indexes[i + 1] = y;
        }
    }
    const indexBuffer = reglInstance.buffer(indexes);
    return {
        buffer: indexBuffer,
        size: 2,
    };
}
function destroyFramebuffer(fbo) {
    var _a;
    if (!fbo)
        return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((_a = fbo === null || fbo === void 0 ? void 0 : fbo._framebuffer) === null || _a === void 0 ? void 0 : _a.framebuffer) {
        fbo.destroy();
    }
}
function destroyBuffer(fbo) {
    var _a;
    if (!fbo)
        return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((_a = fbo === null || fbo === void 0 ? void 0 : fbo._buffer) === null || _a === void 0 ? void 0 : _a.buffer) {
        fbo.destroy();
    }
}

var clearFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nvarying vec2 index;void main(){gl_FragColor=vec4(0.0);}"; // eslint-disable-line

var updateVert = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nattribute vec2 quad;varying vec2 index;void main(){index=(quad+1.0)/2.0;gl_Position=vec4(quad,0,1);}"; // eslint-disable-line

class ForceCenter extends CoreModule {
    create() {
        const { reglInstance } = this;
        this.centermassFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: new Float32Array(4).fill(0),
                shape: [1, 1, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
    }
    initPrograms() {
        const { reglInstance, config, store, data, points } = this;
        this.clearCentermassCommand = reglInstance({
            frag: clearFrag,
            vert: updateVert,
            framebuffer: this.centermassFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
        });
        this.calculateCentermassCommand = reglInstance({
            frag: calculateCentermassFrag,
            vert: calculateCentermassVert,
            framebuffer: () => this.centermassFbo,
            primitive: 'points',
            count: () => data.nodes.length,
            attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                pointsTextureSize: () => store.pointsTextureSize,
            },
            blend: {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: { enable: false, mask: false },
            stencil: { enable: false },
        });
        this.runCommand = reglInstance({
            frag: forceFrag$5,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                centermass: () => this.centermassFbo,
                center: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.center; },
                alpha: () => store.alpha,
            },
        });
    }
    run() {
        var _a, _b, _c;
        (_a = this.clearCentermassCommand) === null || _a === void 0 ? void 0 : _a.call(this);
        (_b = this.calculateCentermassCommand) === null || _b === void 0 ? void 0 : _b.call(this);
        (_c = this.runCommand) === null || _c === void 0 ? void 0 : _c.call(this);
    }
    destroy() {
        destroyFramebuffer(this.centermassFbo);
    }
}

var forceFrag$4 = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform float gravity;uniform float spaceSize;uniform float alpha;varying vec2 index;void main(){vec4 pointPosition=texture2D(position,index);vec4 velocity=vec4(0.0);vec2 centerPosition=vec2(spaceSize/2.0);vec2 distVector=centerPosition-pointPosition.rg;float dist=sqrt(dot(distVector,distVector));if(dist>0.0){float angle=atan(distVector.y,distVector.x);float addV=alpha*gravity*dist*0.1;velocity.rg+=addV*vec2(cos(angle),sin(angle));}gl_FragColor=velocity;}"; // eslint-disable-line

class ForceGravity extends CoreModule {
    initPrograms() {
        const { reglInstance, config, store, points } = this;
        this.runCommand = reglInstance({
            frag: forceFrag$4,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                gravity: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.gravity; },
                spaceSize: () => config.spaceSize,
                alpha: () => store.alpha,
            },
        });
    }
    run() {
        var _a;
        (_a = this.runCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
}

function forceFrag$3(maxLinks) {
    return `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform float linkSpring;
uniform float linkDistance;
uniform vec2 linkDistRandomVariationRange;

uniform sampler2D linkFirstIndicesAndAmount;
uniform sampler2D linkIndices;
uniform sampler2D linkBiasAndStrength;
uniform sampler2D linkRandomDistanceFbo;

uniform float pointsTextureSize;
uniform float linksTextureSize;
uniform float alpha;

varying vec2 index;

const float MAX_LINKS = ${maxLinks}.0;

void main() {
  vec4 pointPosition = texture2D(position, index);
  vec4 velocity = vec4(0.0);

  vec4 linkFirstIJAndAmount = texture2D(linkFirstIndicesAndAmount, index);
  float iCount = linkFirstIJAndAmount.r;
  float jCount = linkFirstIJAndAmount.g;
  float linkAmount = linkFirstIJAndAmount.b;
  if (linkAmount > 0.0) {
    for (float i = 0.0; i < MAX_LINKS; i += 1.0) {
      if (i < linkAmount) {
        if (iCount >= linksTextureSize) {
          iCount = 0.0;
          jCount += 1.0;
        }
        vec2 linkTextureIndex = (vec2(iCount, jCount) + 0.5) / linksTextureSize;
        vec4 connectedPointIndex = texture2D(linkIndices, linkTextureIndex);
        vec4 biasAndStrength = texture2D(linkBiasAndStrength, linkTextureIndex);
        vec4 randomMinDistance = texture2D(linkRandomDistanceFbo, linkTextureIndex);
        float bias = biasAndStrength.r;
        float strength = biasAndStrength.g;
        float randomMinLinkDist = randomMinDistance.r * (linkDistRandomVariationRange.g - linkDistRandomVariationRange.r) + linkDistRandomVariationRange.r;
        randomMinLinkDist *= linkDistance;

        iCount += 1.0;

        vec4 connectedPointPosition = texture2D(position, (connectedPointIndex.rg + 0.5) / pointsTextureSize);
        float x = connectedPointPosition.x - (pointPosition.x + velocity.x);
        float y = connectedPointPosition.y - (pointPosition.y + velocity.y);
        float l = sqrt(x * x + y * y);
        l = max(l, randomMinLinkDist * 0.99);
        l = (l - randomMinLinkDist) / l;
        l *= linkSpring * alpha;
        l *= strength;
        l *= bias;
        x *= l;
        y *= l;
        velocity.x += x;
        velocity.y += y;
      }
    }
  }

  gl_FragColor = vec4(velocity.rg, 0.0, 0.0);
}
  `;
}

var LinkDirection;
(function (LinkDirection) {
    LinkDirection["OUTGOING"] = "outgoing";
    LinkDirection["INCOMING"] = "incoming";
})(LinkDirection || (LinkDirection = {}));
class ForceLink extends CoreModule {
    constructor() {
        super(...arguments);
        this.linkFirstIndicesAndAmount = new Float32Array();
        this.indices = new Float32Array();
        this.maxPointDegree = 0;
    }
    create(direction) {
        const { reglInstance, store: { pointsTextureSize, linksTextureSize }, data } = this;
        this.linkFirstIndicesAndAmount = new Float32Array(pointsTextureSize * pointsTextureSize * 4);
        this.indices = new Float32Array(linksTextureSize * linksTextureSize * 4);
        const linkBiasAndStrengthState = new Float32Array(linksTextureSize * linksTextureSize * 4);
        const linkDistanceState = new Float32Array(linksTextureSize * linksTextureSize * 4);
        const grouped = direction === LinkDirection.INCOMING ? data.groupedSourceToTargetLinks : data.groupedTargetToSourceLinks;
        this.maxPointDegree = 0;
        let linkIndex = 0;
        grouped.forEach((connectedNodeIndices, nodeIndex) => {
            this.linkFirstIndicesAndAmount[nodeIndex * 4 + 0] = linkIndex % linksTextureSize;
            this.linkFirstIndicesAndAmount[nodeIndex * 4 + 1] = Math.floor(linkIndex / linksTextureSize);
            this.linkFirstIndicesAndAmount[nodeIndex * 4 + 2] = connectedNodeIndices.size;
            connectedNodeIndices.forEach((connectedNodeIndex) => {
                var _a, _b;
                this.indices[linkIndex * 4 + 0] = connectedNodeIndex % pointsTextureSize;
                this.indices[linkIndex * 4 + 1] = Math.floor(connectedNodeIndex / pointsTextureSize);
                const degree = (_a = data.degree[data.getInputIndexBySortedIndex(connectedNodeIndex)]) !== null && _a !== void 0 ? _a : 0;
                const connectedDegree = (_b = data.degree[data.getInputIndexBySortedIndex(nodeIndex)]) !== null && _b !== void 0 ? _b : 0;
                const bias = degree / (degree + connectedDegree);
                let strength = 1 / Math.min(degree, connectedDegree);
                strength = Math.sqrt(strength);
                linkBiasAndStrengthState[linkIndex * 4 + 0] = bias;
                linkBiasAndStrengthState[linkIndex * 4 + 1] = strength;
                linkDistanceState[linkIndex * 4] = this.store.getRandomFloat(0, 1);
                linkIndex += 1;
            });
            this.maxPointDegree = Math.max(this.maxPointDegree, connectedNodeIndices.size);
        });
        this.linkFirstIndicesAndAmountFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: this.linkFirstIndicesAndAmount,
                shape: [pointsTextureSize, pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        this.indicesFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: this.indices,
                shape: [linksTextureSize, linksTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        this.biasAndStrengthFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: linkBiasAndStrengthState,
                shape: [linksTextureSize, linksTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        this.randomDistanceFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: linkDistanceState,
                shape: [linksTextureSize, linksTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
    }
    initPrograms() {
        const { reglInstance, config, store, points } = this;
        this.runCommand = reglInstance({
            frag: () => forceFrag$3(this.maxPointDegree),
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                linkSpring: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.linkSpring; },
                linkDistance: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.linkDistance; },
                linkDistRandomVariationRange: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.linkDistRandomVariationRange; },
                linkFirstIndicesAndAmount: () => this.linkFirstIndicesAndAmountFbo,
                linkIndices: () => this.indicesFbo,
                linkBiasAndStrength: () => this.biasAndStrengthFbo,
                linkRandomDistanceFbo: () => this.randomDistanceFbo,
                pointsTextureSize: () => store.pointsTextureSize,
                linksTextureSize: () => store.linksTextureSize,
                alpha: () => store.alpha,
            },
        });
    }
    run() {
        var _a;
        (_a = this.runCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    destroy() {
        destroyFramebuffer(this.linkFirstIndicesAndAmountFbo);
        destroyFramebuffer(this.indicesFbo);
        destroyFramebuffer(this.biasAndStrengthFbo);
        destroyFramebuffer(this.randomDistanceFbo);
    }
}

var calculateLevelFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nvarying vec4 rgba;void main(){gl_FragColor=rgba;}"; // eslint-disable-line

var calculateLevelVert = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform float pointsTextureSize;uniform float levelTextureSize;uniform float cellSize;attribute vec2 indexes;varying vec4 rgba;void main(){vec4 pointPosition=texture2D(position,indexes/pointsTextureSize);rgba=vec4(pointPosition.rg,1.0,0.0);float n=floor(pointPosition.x/cellSize);float m=floor(pointPosition.y/cellSize);vec2 levelPosition=2.0*(vec2(n,m)+0.5)/levelTextureSize-1.0;gl_Position=vec4(levelPosition,0.0,1.0);gl_PointSize=1.0;}"; // eslint-disable-line

var forceFrag$2 = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D levelFbo;uniform float level;uniform float levels;uniform float levelTextureSize;uniform float repulsion;uniform float alpha;uniform float spaceSize;uniform float theta;varying vec2 index;const float MAX_LEVELS_NUM=14.0;vec2 calcAdd(vec2 ij,vec2 pp){vec2 add=vec2(0.0);vec4 centermass=texture2D(levelFbo,ij);if(centermass.r>0.0&&centermass.g>0.0&&centermass.b>0.0){vec2 centermassPosition=vec2(centermass.rg/centermass.b);vec2 distVector=pp-centermassPosition;float l=dot(distVector,distVector);float dist=sqrt(l);if(l>0.0){float angle=atan(distVector.y,distVector.x);float c=alpha*repulsion*centermass.b;float distanceMin2=1.0;if(l<distanceMin2)l=sqrt(distanceMin2*l);float addV=c/sqrt(l);add=addV*vec2(cos(angle),sin(angle));}}return add;}void main(){vec4 pointPosition=texture2D(position,index);float x=pointPosition.x;float y=pointPosition.y;float left=0.0;float top=0.0;float right=spaceSize;float bottom=spaceSize;float n_left=0.0;float n_top=0.0;float n_right=0.0;float n_bottom=0.0;float cellSize=0.0;for(float i=0.0;i<MAX_LEVELS_NUM;i+=1.0){if(i<=level){left+=cellSize*n_left;top+=cellSize*n_top;right-=cellSize*n_right;bottom-=cellSize*n_bottom;cellSize=pow(2.0,levels-i-1.0);float dist_left=x-left;n_left=max(0.0,floor(dist_left/cellSize-theta));float dist_top=y-top;n_top=max(0.0,floor(dist_top/cellSize-theta));float dist_right=right-x;n_right=max(0.0,floor(dist_right/cellSize-theta));float dist_bottom=bottom-y;n_bottom=max(0.0,floor(dist_bottom/cellSize-theta));}}vec4 velocity=vec4(vec2(0.0),1.0,0.0);for(float i=0.0;i<12.0;i+=1.0){for(float j=0.0;j<4.0;j+=1.0){float n=left+cellSize*j;float m=top+cellSize*n_top+cellSize*i;if(n<(left+n_left*cellSize)&&m<bottom){velocity.xy+=calcAdd(vec2(n/cellSize,m/cellSize)/levelTextureSize,pointPosition.xy);}n=left+cellSize*i;m=top+cellSize*j;if(n<(right-n_right*cellSize)&&m<(top+n_top*cellSize)){velocity.xy+=calcAdd(vec2(n/cellSize,m/cellSize)/levelTextureSize,pointPosition.xy);}n=right-n_right*cellSize+cellSize*j;m=top+cellSize*i;if(n<right&&m<(bottom-n_bottom*cellSize)){velocity.xy+=calcAdd(vec2(n/cellSize,m/cellSize)/levelTextureSize,pointPosition.xy);}n=left+n_left*cellSize+cellSize*i;m=bottom-n_bottom*cellSize+cellSize*j;if(n<right&&m<bottom){velocity.xy+=calcAdd(vec2(n/cellSize,m/cellSize)/levelTextureSize,pointPosition.xy);}}}gl_FragColor=velocity;}"; // eslint-disable-line

var forceCenterFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D levelFbo;uniform sampler2D randomValues;uniform float levelTextureSize;uniform float repulsion;uniform float alpha;varying vec2 index;vec2 calcAdd(vec2 ij,vec2 pp){vec2 add=vec2(0.0);vec4 centermass=texture2D(levelFbo,ij);if(centermass.r>0.0&&centermass.g>0.0&&centermass.b>0.0){vec2 centermassPosition=vec2(centermass.rg/centermass.b);vec2 distVector=pp-centermassPosition;float l=dot(distVector,distVector);float dist=sqrt(l);if(l>0.0){float angle=atan(distVector.y,distVector.x);float c=alpha*repulsion*centermass.b;float distanceMin2=1.0;if(l<distanceMin2)l=sqrt(distanceMin2*l);float addV=c/sqrt(l);add=addV*vec2(cos(angle),sin(angle));}}return add;}void main(){vec4 pointPosition=texture2D(position,index);vec4 random=texture2D(randomValues,index);vec4 velocity=vec4(0.0);velocity.xy+=calcAdd(pointPosition.xy/levelTextureSize,pointPosition.xy);velocity.xy+=velocity.xy*random.rg;gl_FragColor=velocity;}"; // eslint-disable-line

class ForceManyBody extends CoreModule {
    constructor() {
        super(...arguments);
        this.levelsFbos = new Map();
        this.quadtreeLevels = 0;
    }
    create() {
        var _a;
        const { reglInstance, config, store } = this;
        this.quadtreeLevels = Math.log2((_a = config.spaceSize) !== null && _a !== void 0 ? _a : defaultConfigValues.spaceSize);
        for (let i = 0; i < this.quadtreeLevels; i += 1) {
            const levelTextureSize = Math.pow(2, i + 1);
            this.levelsFbos.set(`level[${i}]`, reglInstance.framebuffer({
                shape: [levelTextureSize, levelTextureSize],
                colorType: 'float',
                depth: false,
                stencil: false,
            }));
        }
        // Create random number to prevent point to stick together in one coordinate
        const randomValuesState = new Float32Array(store.pointsTextureSize * store.pointsTextureSize * 4);
        for (let i = 0; i < store.pointsTextureSize * store.pointsTextureSize; ++i) {
            randomValuesState[i * 4] = store.getRandomFloat(-1, 1) * 0.00001;
            randomValuesState[i * 4 + 1] = store.getRandomFloat(-1, 1) * 0.00001;
        }
        this.randomValuesFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: randomValuesState,
                shape: [store.pointsTextureSize, store.pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
    }
    initPrograms() {
        const { reglInstance, config, store, data, points } = this;
        this.clearLevelsCommand = reglInstance({
            frag: clearFrag,
            vert: updateVert,
            framebuffer: (_, props) => props.levelFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
        });
        this.calculateLevelsCommand = reglInstance({
            frag: calculateLevelFrag,
            vert: calculateLevelVert,
            framebuffer: (_, props) => props.levelFbo,
            primitive: 'points',
            count: () => data.nodes.length,
            attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                pointsTextureSize: () => store.pointsTextureSize,
                levelTextureSize: (_, props) => props.levelTextureSize,
                cellSize: (_, props) => props.cellSize,
            },
            blend: {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: { enable: false, mask: false },
            stencil: { enable: false },
        });
        this.forceCommand = reglInstance({
            frag: forceFrag$2,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                level: (_, props) => props.level,
                levels: this.quadtreeLevels,
                levelFbo: (_, props) => props.levelFbo,
                levelTextureSize: (_, props) => props.levelTextureSize,
                alpha: () => store.alpha,
                repulsion: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsion; },
                spaceSize: () => config.spaceSize,
                theta: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsionTheta; },
            },
            blend: {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: { enable: false, mask: false },
            stencil: { enable: false },
        });
        this.forceFromItsOwnCentermassCommand = reglInstance({
            frag: forceCenterFrag,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                randomValues: () => this.randomValuesFbo,
                levelFbo: (_, props) => props.levelFbo,
                levelTextureSize: (_, props) => props.levelTextureSize,
                alpha: () => store.alpha,
                repulsion: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsion; },
                spaceSize: () => config.spaceSize,
            },
            blend: {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: { enable: false, mask: false },
            stencil: { enable: false },
        });
        this.clearVelocityCommand = reglInstance({
            frag: clearFrag,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
        });
    }
    run() {
        var _a, _b, _c, _d, _e, _f;
        const { config } = this;
        for (let i = 0; i < this.quadtreeLevels; i += 1) {
            (_a = this.clearLevelsCommand) === null || _a === void 0 ? void 0 : _a.call(this, { levelFbo: this.levelsFbos.get(`level[${i}]`) });
            const levelTextureSize = Math.pow(2, i + 1);
            const cellSize = ((_b = config.spaceSize) !== null && _b !== void 0 ? _b : defaultConfigValues.spaceSize) / levelTextureSize;
            (_c = this.calculateLevelsCommand) === null || _c === void 0 ? void 0 : _c.call(this, {
                levelFbo: this.levelsFbos.get(`level[${i}]`),
                levelTextureSize,
                cellSize,
            });
        }
        (_d = this.clearVelocityCommand) === null || _d === void 0 ? void 0 : _d.call(this);
        for (let i = 0; i < this.quadtreeLevels; i += 1) {
            const levelTextureSize = Math.pow(2, i + 1);
            (_e = this.forceCommand) === null || _e === void 0 ? void 0 : _e.call(this, {
                levelFbo: this.levelsFbos.get(`level[${i}]`),
                levelTextureSize,
                level: i,
            });
            if (i === this.quadtreeLevels - 1) {
                (_f = this.forceFromItsOwnCentermassCommand) === null || _f === void 0 ? void 0 : _f.call(this, {
                    levelFbo: this.levelsFbos.get(`level[${i}]`),
                    levelTextureSize,
                    level: i,
                });
            }
        }
    }
    destroy() {
        destroyFramebuffer(this.randomValuesFbo);
        this.levelsFbos.forEach(fbo => {
            destroyFramebuffer(fbo);
        });
        this.levelsFbos.clear();
    }
}

function forceFrag$1(startLevel, maxLevels) {
    startLevel = Math.min(startLevel, maxLevels);
    const delta = maxLevels - startLevel;
    const calcAdd = `
    float dist = sqrt(l);
    if (dist > 0.0) {
      float c = alpha * repulsion * centermass.b;
      addVelocity += calcAdd(vec2(x, y), l, c);
      addVelocity += addVelocity * random.rg;
    }
  `;
    function quad(level) {
        if (level >= maxLevels) {
            return calcAdd;
        }
        else {
            const groupSize = Math.pow(2, level + 1);
            const iEnding = new Array(level + 1 - delta).fill(0).map((_, l) => `pow(2.0, ${level - (l + delta)}.0) * i${l + delta}`).join('+');
            const jEnding = new Array(level + 1 - delta).fill(0).map((_, l) => `pow(2.0, ${level - (l + delta)}.0) * j${l + delta}`).join('+');
            return `
      for (float ij${level} = 0.0; ij${level} < 4.0; ij${level} += 1.0) {
        float i${level} = 0.0;
        float j${level} = 0.0;
        if (ij${level} == 1.0 || ij${level} == 3.0) i${level} = 1.0;
        if (ij${level} == 2.0 || ij${level} == 3.0) j${level} = 1.0;
        float i = pow(2.0, ${startLevel}.0) * n / width${level + 1} + ${iEnding};
        float j = pow(2.0, ${startLevel}.0) * m / width${level + 1} + ${jEnding};
        float groupPosX = (i + 0.5) / ${groupSize}.0;
        float groupPosY = (j + 0.5) / ${groupSize}.0;
        
        vec4 centermass = texture2D(level[${level}], vec2(groupPosX, groupPosY));
        if (centermass.r > 0.0 && centermass.g > 0.0 && centermass.b > 0.0) {
          float x = centermass.r / centermass.b - pointPosition.r;
          float y = centermass.g / centermass.b - pointPosition.g;
          float l = x * x + y * y;
          if ((width${level + 1} * width${level + 1}) / theta < l) {
            ${calcAdd}
          } else {
            ${quad(level + 1)}
          }
        }
      }
      `;
        }
    }
    return `
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D position;
uniform sampler2D randomValues;
uniform float spaceSize;
uniform float repulsion;
uniform float theta;
uniform float alpha;
uniform sampler2D level[${maxLevels}];
varying vec2 index;

vec2 calcAdd(vec2 xy, float l, float c) {
  float distanceMin2 = 1.0;
  if (l < distanceMin2) l = sqrt(distanceMin2 * l);
  float add = c / l;
  return add * xy;
}

void main() {
  vec4 pointPosition = texture2D(position, index);
  vec4 random = texture2D(randomValues, index);

  float width0 = spaceSize;

  vec2 velocity = vec2(0.0);
  vec2 addVelocity = vec2(0.0);

  ${new Array(maxLevels).fill(0).map((_, i) => `float width${i + 1} = width${i} / 2.0;`).join('\n')}

  for (float n = 0.0; n < pow(2.0, ${delta}.0); n += 1.0) {
    for (float m = 0.0; m < pow(2.0, ${delta}.0); m += 1.0) {
      ${quad(delta)}
    }
  }

  velocity -= addVelocity;

  gl_FragColor = vec4(velocity, 0.0, 0.0);
}
`;
}

class ForceManyBodyQuadtree extends CoreModule {
    constructor() {
        super(...arguments);
        this.levelsFbos = new Map();
        this.quadtreeLevels = 0;
    }
    create() {
        var _a;
        const { reglInstance, config, store } = this;
        this.quadtreeLevels = Math.log2((_a = config.spaceSize) !== null && _a !== void 0 ? _a : defaultConfigValues.spaceSize);
        for (let i = 0; i < this.quadtreeLevels; i += 1) {
            const levelTextureSize = Math.pow(2, i + 1);
            this.levelsFbos.set(`level[${i}]`, reglInstance.framebuffer({
                color: reglInstance.texture({
                    data: new Float32Array(levelTextureSize * levelTextureSize * 4),
                    shape: [levelTextureSize, levelTextureSize, 4],
                    type: 'float',
                }),
                depth: false,
                stencil: false,
            }));
        }
        // Create random number to prevent point to stick together in one coordinate
        const randomValuesState = new Float32Array(store.pointsTextureSize * store.pointsTextureSize * 4);
        for (let i = 0; i < store.pointsTextureSize * store.pointsTextureSize; ++i) {
            randomValuesState[i * 4] = store.getRandomFloat(-1, 1) * 0.00001;
            randomValuesState[i * 4 + 1] = store.getRandomFloat(-1, 1) * 0.00001;
        }
        this.randomValuesFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: randomValuesState,
                shape: [store.pointsTextureSize, store.pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
    }
    initPrograms() {
        var _a, _b;
        const { reglInstance, config, store, data, points } = this;
        this.clearLevelsCommand = reglInstance({
            frag: clearFrag,
            vert: updateVert,
            framebuffer: (_, props) => props.levelFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
        });
        this.calculateLevelsCommand = reglInstance({
            frag: calculateLevelFrag,
            vert: calculateLevelVert,
            framebuffer: (_, props) => props.levelFbo,
            primitive: 'points',
            count: () => data.nodes.length,
            attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                pointsTextureSize: () => store.pointsTextureSize,
                levelTextureSize: (_, props) => props.levelTextureSize,
                cellSize: (_, props) => props.cellSize,
            },
            blend: {
                enable: true,
                func: {
                    src: 'one',
                    dst: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: { enable: false, mask: false },
            stencil: { enable: false },
        });
        this.quadtreeCommand = reglInstance({
            frag: forceFrag$1((_b = (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsionQuadtreeLevels) !== null && _b !== void 0 ? _b : this.quadtreeLevels, this.quadtreeLevels),
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                randomValues: () => this.randomValuesFbo,
                spaceSize: () => config.spaceSize,
                repulsion: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsion; },
                theta: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsionTheta; },
                alpha: () => store.alpha,
                ...Object.fromEntries(this.levelsFbos),
            },
        });
    }
    run() {
        var _a, _b, _c, _d;
        const { config } = this;
        for (let i = 0; i < this.quadtreeLevels; i += 1) {
            (_a = this.clearLevelsCommand) === null || _a === void 0 ? void 0 : _a.call(this, { levelFbo: this.levelsFbos.get(`level[${i}]`) });
            const levelTextureSize = Math.pow(2, i + 1);
            const cellSize = ((_b = config.spaceSize) !== null && _b !== void 0 ? _b : defaultConfigValues.spaceSize) / levelTextureSize;
            (_c = this.calculateLevelsCommand) === null || _c === void 0 ? void 0 : _c.call(this, {
                levelFbo: this.levelsFbos.get(`level[${i}]`),
                levelTextureSize,
                cellSize,
            });
        }
        (_d = this.quadtreeCommand) === null || _d === void 0 ? void 0 : _d.call(this);
    }
    destroy() {
        destroyFramebuffer(this.randomValuesFbo);
        this.levelsFbos.forEach(fbo => {
            destroyFramebuffer(fbo);
        });
        this.levelsFbos.clear();
    }
}

var forceFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform float repulsion;uniform vec2 mousePos;varying vec2 index;void main(){vec4 pointPosition=texture2D(position,index);vec4 velocity=vec4(0.0);vec2 mouse=mousePos;vec2 distVector=mouse-pointPosition.rg;float dist=sqrt(dot(distVector,distVector));dist=max(dist,10.0);float angle=atan(distVector.y,distVector.x);float addV=100.0*repulsion/(dist*dist);velocity.rg-=addV*vec2(cos(angle),sin(angle));gl_FragColor=velocity;}"; // eslint-disable-line

class ForceMouse extends CoreModule {
    initPrograms() {
        const { reglInstance, config, store, points } = this;
        this.runCommand = reglInstance({
            frag: forceFrag,
            vert: updateVert,
            framebuffer: () => points === null || points === void 0 ? void 0 : points.velocityFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => points === null || points === void 0 ? void 0 : points.previousPositionFbo,
                mousePos: () => store.mousePosition,
                repulsion: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.repulsionFromMouse; },
            },
        });
    }
    run() {
        var _a;
        (_a = this.runCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var glBench = {exports: {}};

(function (module, exports) {
	(function (global, factory) {
	  module.exports = factory() ;
	}(commonjsGlobal, (function () {
	  var UISVG = "<div class=\"gl-box\">\n  <svg viewBox=\"0 0 55 60\">\n    <text x=\"27\" y=\"56\" class=\"gl-fps\">00 FPS</text>\n    <text x=\"28\" y=\"8\" class=\"gl-mem\"></text>\n    <rect x=\"0\" y=\"14\" rx=\"4\" ry=\"4\" width=\"55\" height=\"32\"></rect>\n    <polyline class=\"gl-chart\"></polyline>\n  </svg>\n  <svg viewBox=\"0 0 14 60\" class=\"gl-cpu-svg\">\n    <line x1=\"7\" y1=\"38\" x2=\"7\" y2=\"11\" class=\"opacity\"/>\n    <line x1=\"7\" y1=\"38\" x2=\"7\" y2=\"11\" class=\"gl-cpu\" stroke-dasharray=\"0 27\"/>\n    <path d=\"M5.35 43c-.464 0-.812.377-.812.812v1.16c-.783.1972-1.421.812-1.595 1.624h-1.16c-.435 0-.812.348-.812.812s.348.812.812.812h1.102v1.653H1.812c-.464 0-.812.377-.812.812 0 .464.377.812.812.812h1.131c.1943.783.812 1.392 1.595 1.595v1.131c0 .464.377.812.812.812.464 0 .812-.377.812-.812V53.15h1.653v1.073c0 .464.377.812.812.812.464 0 .812-.377.812-.812v-1.131c.783-.1943 1.392-.812 1.595-1.595h1.131c.464 0 .812-.377.812-.812 0-.464-.377-.812-.812-.812h-1.073V48.22h1.102c.435 0 .812-.348.812-.812s-.348-.812-.812-.812h-1.16c-.1885-.783-.812-1.421-1.595-1.624v-1.131c0-.464-.377-.812-.812-.812-.464 0-.812.377-.812.812v1.073H6.162v-1.073c0-.464-.377-.812-.812-.812zm.58 3.48h2.088c.754 0 1.363.609 1.363 1.363v2.088c0 .754-.609 1.363-1.363 1.363H5.93c-.754 0-1.363-.609-1.363-1.363v-2.088c0-.754.609-1.363 1.363-1.363z\"/>\n  </svg>\n  <svg viewBox=\"0 0 14 60\" class=\"gl-gpu-svg\">\n    <line x1=\"7\" y1=\"38\" x2=\"7\" y2=\"11\" class=\"opacity\"/>\n    <line x1=\"7\" y1=\"38\" x2=\"7\" y2=\"11\" class=\"gl-gpu\" stroke-dasharray=\"0 27\"/>\n    <path d=\"M1.94775 43.3772a.736.736 0 10-.00416 1.472c.58535.00231.56465.1288.6348.3197.07015.18975.04933.43585.04933.43585l-.00653.05405v8.671a.736.736 0 101.472 0v-1.4145c.253.09522.52785.1495.81765.1495h5.267c1.2535 0 2.254-.9752 2.254-2.185v-3.105c0-1.2075-1.00625-2.185-2.254-2.185h-5.267c-.28865 0-.5635.05405-.8165.1495.01806-.16445.04209-.598-.1357-1.0787-.22425-.6072-.9499-1.2765-2.0125-1.2765zm2.9095 3.6455c.42435 0 .7659.36225.7659.8119v2.9785c0 .44965-.34155.8119-.7659.8119s-.7659-.36225-.7659-.8119v-2.9785c0-.44965.34155-.8119.7659-.8119zm4.117 0a2.3 2.3 0 012.3 2.3 2.3 2.3 0 01-2.3 2.3 2.3 2.3 0 01-2.3-2.3 2.3 2.3 0 012.3-2.3z\"/>\n  </svg>\n</div>";

	  var UICSS = "#gl-bench {\n  position:absolute;\n  left:0;\n  top:0;\n  z-index:1000;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  user-select: none;\n}\n\n#gl-bench div {\n  position: relative;\n  display: block;\n  margin: 4px;\n  padding: 0 7px 0 10px;\n  background: #6c6;\n  border-radius: 15px;\n  cursor: pointer;\n  opacity: 0.9;\n}\n\n#gl-bench svg {\n  height: 60px;\n  margin: 0 -1px;\n}\n\n#gl-bench text {\n  font-size: 12px;\n  font-family: Helvetica,Arial,sans-serif;\n  font-weight: 700;\n  dominant-baseline: middle;\n  text-anchor: middle;\n}\n\n#gl-bench .gl-mem {\n  font-size: 9px;\n}\n\n#gl-bench line {\n  stroke-width: 5;\n  stroke: #112211;\n  stroke-linecap: round;\n}\n\n#gl-bench polyline {\n  fill: none;\n  stroke: #112211;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  stroke-width: 3.5;\n}\n\n#gl-bench rect {\n  fill: #448844;\n}\n\n#gl-bench .opacity {\n  stroke: #448844;\n}\n";

	  class GLBench {

	    /** GLBench constructor
	     * @param { WebGLRenderingContext | WebGL2RenderingContext } gl context
	     * @param { Object | undefined } settings additional settings
	     */
	    constructor(gl, settings = {}) {
	      this.css = UICSS;
	      this.svg = UISVG;
	      this.paramLogger = () => {};
	      this.chartLogger = () => {};
	      this.chartLen = 20;
	      this.chartHz = 20;

	      this.names = [];
	      this.cpuAccums = [];
	      this.gpuAccums = [];  
	      this.activeAccums = [];
	      this.chart = new Array(this.chartLen);
	      this.now = () => (performance && performance.now) ? performance.now() : Date.now();
	      this.updateUI = () => {
	        [].forEach.call(this.nodes['gl-gpu-svg'], node => {
	          node.style.display = this.trackGPU ? 'inline' : 'none';
	        });
	      };

	      Object.assign(this, settings);
	      this.detected = 0;
	      this.finished = [];
	      this.isFramebuffer = 0;
	      this.frameId = 0;

	      // 120hz device detection
	      let rafId, n = 0, t0;
	      let loop = (t) => {
	        if (++n < 20) {
	          rafId = requestAnimationFrame(loop);
	        } else {
	          this.detected = Math.ceil(1e3 * n / (t - t0) / 70);
	          cancelAnimationFrame(rafId);
	        }
	        if (!t0) t0 = t;
	      };
	      requestAnimationFrame(loop);

	      // attach gpu profilers
	      if (gl) {
	        const glFinish = async (t, activeAccums) =>
	          Promise.resolve(setTimeout(() => {
	            gl.getError();
	            const dt = this.now() - t;
	            activeAccums.forEach((active, i) => {
	              if (active) this.gpuAccums[i] += dt;
	            });
	          }, 0));

	        const addProfiler = (fn, self, target) => function() {
	          const t = self.now();
	          fn.apply(target, arguments);
	          if (self.trackGPU) self.finished.push(glFinish(t, self.activeAccums.slice(0)));
	        };

	        ['drawArrays', 'drawElements', 'drawArraysInstanced',
	          'drawBuffers', 'drawElementsInstanced', 'drawRangeElements']
	          .forEach(fn => { if (gl[fn]) gl[fn] = addProfiler(gl[fn], this, gl); });

	        gl.getExtension = ((fn, self) => function() {
	          let ext = fn.apply(gl, arguments);
	          if (ext) {
	            ['drawElementsInstancedANGLE', 'drawBuffersWEBGL']
	              .forEach(fn => { if (ext[fn]) ext[fn] = addProfiler(ext[fn], self, ext); });
	          }
	          return ext;
	        })(gl.getExtension, this);
	      }

	      // init ui and ui loggers
	      if (!this.withoutUI) {
	        if (!this.dom) this.dom = document.body;
	        let elm = document.createElement('div');
	        elm.id = 'gl-bench';
	        this.dom.appendChild(elm);
	        this.dom.insertAdjacentHTML('afterbegin', '<style id="gl-bench-style">' + this.css + '</style>');
	        this.dom = elm;
	        this.dom.addEventListener('click', () => {
	          this.trackGPU = !this.trackGPU;
	          this.updateUI();
	        });

	        this.paramLogger = ((logger, dom, names) => {
	          const classes = ['gl-cpu', 'gl-gpu', 'gl-mem', 'gl-fps', 'gl-gpu-svg', 'gl-chart'];
	          const nodes = Object.assign({}, classes);
	          classes.forEach(c => nodes[c] = dom.getElementsByClassName(c));
	          this.nodes = nodes;
	          return (i, cpu, gpu, mem, fps, totalTime, frameId) => {
	            nodes['gl-cpu'][i].style.strokeDasharray = (cpu * 0.27).toFixed(0) + ' 100';
	            nodes['gl-gpu'][i].style.strokeDasharray = (gpu * 0.27).toFixed(0) + ' 100';
	            nodes['gl-mem'][i].innerHTML = names[i] ? names[i] : (mem ? 'mem: ' + mem.toFixed(0) + 'mb' : '');
	            nodes['gl-fps'][i].innerHTML = fps.toFixed(0) + ' FPS';
	            logger(names[i], cpu, gpu, mem, fps, totalTime, frameId);
	          }
	        })(this.paramLogger, this.dom, this.names);

	        this.chartLogger = ((logger, dom) => {
	          let nodes = { 'gl-chart': dom.getElementsByClassName('gl-chart') };
	          return (i, chart, circularId) => {
	            let points = '';
	            let len = chart.length;
	            for (let i = 0; i < len; i++) {
	              let id = (circularId + i + 1) % len;
	              if (chart[id] != undefined) {
	                points = points + ' ' + (55 * i / (len - 1)).toFixed(1) + ','
	                  + (45 - chart[id] * 22 / 60 / this.detected).toFixed(1);
	              }
	            }
	            nodes['gl-chart'][i].setAttribute('points', points);
	            logger(this.names[i], chart, circularId);
	          }
	        })(this.chartLogger, this.dom);
	      }
	    }

	    /**
	     * Explicit UI add
	     * @param { string | undefined } name 
	     */
	    addUI(name) {
	      if (this.names.indexOf(name) == -1) {
	        this.names.push(name);
	        if (this.dom) {
	          this.dom.insertAdjacentHTML('beforeend', this.svg);
	          this.updateUI();
	        }
	        this.cpuAccums.push(0);
	        this.gpuAccums.push(0);
	        this.activeAccums.push(false);
	      }
	    }

	    /**
	     * Increase frameID
	     * @param { number | undefined } now
	     */
	    nextFrame(now) {
	      this.frameId++;
	      const t = now ? now : this.now();

	      // params
	      if (this.frameId <= 1) {
	        this.paramFrame = this.frameId;
	        this.paramTime = t;
	      } else {
	        let duration = t - this.paramTime;
	        if (duration >= 1e3) {
	          const frameCount = this.frameId - this.paramFrame;
	          const fps = frameCount / duration * 1e3;
	          for (let i = 0; i < this.names.length; i++) {
	            const cpu = this.cpuAccums[i] / duration * 100,
	              gpu = this.gpuAccums[i] / duration * 100,
	              mem = (performance && performance.memory) ? performance.memory.usedJSHeapSize / (1 << 20) : 0;
	            this.paramLogger(i, cpu, gpu, mem, fps, duration, frameCount);
	            this.cpuAccums[i] = 0;
	            Promise.all(this.finished).then(() => {
	              this.gpuAccums[i] = 0;
	              this.finished = [];
	            });
	          }
	          this.paramFrame = this.frameId;
	          this.paramTime = t;
	        }
	      }

	      // chart
	      if (!this.detected || !this.chartFrame) {
	        this.chartFrame = this.frameId;
	        this.chartTime = t;
	        this.circularId = 0;
	      } else {
	        let timespan = t - this.chartTime;
	        let hz = this.chartHz * timespan / 1e3;
	        while (--hz > 0 && this.detected) {
	          const frameCount = this.frameId - this.chartFrame;
	          const fps = frameCount / timespan * 1e3;
	          this.chart[this.circularId % this.chartLen] = fps;
	          for (let i = 0; i < this.names.length; i++) {
	            this.chartLogger(i, this.chart, this.circularId);
	          }
	          this.circularId++;
	          this.chartFrame = this.frameId;
	          this.chartTime = t;
	        }
	      }
	    }

	    /**
	     * Begin named measurement
	     * @param { string | undefined } name
	     */
	    begin(name) {
	      this.updateAccums(name);
	    }

	    /**
	     * End named measure
	     * @param { string | undefined } name
	     */
	    end(name) {
	      this.updateAccums(name);
	    }

	    updateAccums(name) {
	      let nameId = this.names.indexOf(name);
	      if (nameId == -1) {
	        nameId = this.names.length;
	        this.addUI(name);
	      }

	      const t = this.now();
	      const dt = t - this.t0;
	      for (let i = 0; i < nameId + 1; i++) {
	        if (this.activeAccums[i]) {
	          this.cpuAccums[i] += dt;
	        }
	      }    this.activeAccums[nameId] = !this.activeAccums[nameId];
	      this.t0 = t;
	    }

	  }

	  return GLBench;

	})));
} (glBench));

var GLBench = glBench.exports;

const benchCSS = `
  #gl-bench {
    position:absolute;
    right:0;
    top:0;
    z-index:1000;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }
  #gl-bench div {
    position: relative;
    display: block;
    margin: 4px;
    padding: 0 7px 0 10px;
    background: #5f69de;
    border-radius: 15px;
    cursor: pointer;
    opacity: 0.9;
  }
  #gl-bench svg {
    height: 60px;
    margin: 0 -1px;
  }
  #gl-bench text {
    font-size: 12px;
    font-family: Helvetica,Arial,sans-serif;
    font-weight: 700;
    dominant-baseline: middle;
    text-anchor: middle;
  }
  #gl-bench .gl-mem {
    font-size: 9px;
  }
  #gl-bench line {
    stroke-width: 5;
    stroke: #112211;
    stroke-linecap: round;
  }
  #gl-bench polyline {
    fill: none;
    stroke: #112211;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 3.5;
  }
  #gl-bench rect {
    fill: #8288e4;
  }
  #gl-bench .opacity {
    stroke: #8288e4;
  }
`;

class FPSMonitor {
    constructor(canvas) {
        this.destroy();
        const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        this.bench = new GLBench(gl, { css: benchCSS });
    }
    begin() {
        var _a;
        (_a = this.bench) === null || _a === void 0 ? void 0 : _a.begin('frame');
    }
    end(now) {
        var _a, _b;
        (_a = this.bench) === null || _a === void 0 ? void 0 : _a.end('frame');
        (_b = this.bench) === null || _b === void 0 ? void 0 : _b.nextFrame(now);
    }
    destroy() {
        this.bench = undefined;
        select('#gl-bench').remove();
    }
}

class GraphData {
    constructor() {
        /** Links that have existing source and target nodes  */
        this.completeLinks = new Set();
        this.degree = [];
        /** Mapping the source node index to a `Set` of target node indices connected to that node */
        this.groupedSourceToTargetLinks = new Map();
        /** Mapping the target node index to a `Set` of source node indices connected to that node */
        this.groupedTargetToSourceLinks = new Map();
        this._nodes = [];
        this._links = [];
        /** Mapping the original id to the original node */
        this.idToNodeMap = new Map();
        /** We want to display more important nodes (i.e. with the biggest number of connections)
         * on top of the other. To render them in the right order,
         * we create an array of node indices sorted by degree (number of connections)
         * and and we store multiple maps that help us referencing the right data objects
         * and other properties by original node index, sorted index, and id 👇. */
        /** Mapping the sorted index to the original index */
        this.sortedIndexToInputIndexMap = new Map();
        /** Mapping the original index to the sorted index of the node */
        this.inputIndexToSortedIndexMap = new Map();
        /** Mapping the original id to the sorted index of the node */
        this.idToSortedIndexMap = new Map();
        /** Mapping the original index to the original id of the node */
        this.inputIndexToIdMap = new Map();
        /** Mapping the original id to the indegree value of the node */
        this.idToIndegreeMap = new Map();
        /** Mapping the original id to the outdegree value of the node */
        this.idToOutdegreeMap = new Map();
    }
    get nodes() {
        return this._nodes;
    }
    get links() {
        return this._links;
    }
    get linksNumber() {
        return this.completeLinks.size;
    }
    setData(inputNodes, inputLinks) {
        this.idToNodeMap.clear();
        this.idToSortedIndexMap.clear();
        this.inputIndexToIdMap.clear();
        this.idToIndegreeMap.clear();
        this.idToOutdegreeMap.clear();
        inputNodes.forEach((n, i) => {
            this.idToNodeMap.set(n.id, n);
            this.inputIndexToIdMap.set(i, n.id);
            this.idToIndegreeMap.set(n.id, 0);
            this.idToOutdegreeMap.set(n.id, 0);
        });
        // Calculate node outdegree/indegree values
        // And filter links if source/target node does not exist
        this.completeLinks.clear();
        inputLinks.forEach(l => {
            const sourceNode = this.idToNodeMap.get(l.source);
            const targetNode = this.idToNodeMap.get(l.target);
            if (sourceNode !== undefined && targetNode !== undefined) {
                this.completeLinks.add(l);
                const outdegree = this.idToOutdegreeMap.get(sourceNode.id);
                if (outdegree !== undefined)
                    this.idToOutdegreeMap.set(sourceNode.id, outdegree + 1);
                const indegree = this.idToIndegreeMap.get(targetNode.id);
                if (indegree !== undefined)
                    this.idToIndegreeMap.set(targetNode.id, indegree + 1);
            }
        });
        // Calculate node degree value
        this.degree = new Array(inputNodes.length);
        inputNodes.forEach((n, i) => {
            const outdegree = this.idToOutdegreeMap.get(n.id);
            const indegree = this.idToIndegreeMap.get(n.id);
            this.degree[i] = (outdegree !== null && outdegree !== void 0 ? outdegree : 0) + (indegree !== null && indegree !== void 0 ? indegree : 0);
        });
        // Sort nodes by degree value
        this.sortedIndexToInputIndexMap.clear();
        this.inputIndexToSortedIndexMap.clear();
        const sortedDegrees = Object.entries(this.degree).sort((a, b) => a[1] - b[1]);
        sortedDegrees.forEach(([inputStringedIndex], sortedIndex) => {
            const inputIndex = +inputStringedIndex;
            this.sortedIndexToInputIndexMap.set(sortedIndex, inputIndex);
            this.inputIndexToSortedIndexMap.set(inputIndex, sortedIndex);
            this.idToSortedIndexMap.set(this.inputIndexToIdMap.get(inputIndex), sortedIndex);
        });
        this.groupedSourceToTargetLinks.clear();
        this.groupedTargetToSourceLinks.clear();
        inputLinks.forEach((l) => {
            const sourceIndex = this.idToSortedIndexMap.get(l.source);
            const targetIndex = this.idToSortedIndexMap.get(l.target);
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                if (this.groupedSourceToTargetLinks.get(sourceIndex) === undefined)
                    this.groupedSourceToTargetLinks.set(sourceIndex, new Set());
                const targets = this.groupedSourceToTargetLinks.get(sourceIndex);
                targets === null || targets === void 0 ? void 0 : targets.add(targetIndex);
                if (this.groupedTargetToSourceLinks.get(targetIndex) === undefined)
                    this.groupedTargetToSourceLinks.set(targetIndex, new Set());
                const sources = this.groupedTargetToSourceLinks.get(targetIndex);
                sources === null || sources === void 0 ? void 0 : sources.add(sourceIndex);
            }
        });
        this._nodes = inputNodes;
        this._links = inputLinks;
    }
    getNodeById(id) {
        return this.idToNodeMap.get(id);
    }
    getNodeByIndex(index) {
        return this._nodes[index];
    }
    getSortedIndexByInputIndex(index) {
        return this.inputIndexToSortedIndexMap.get(index);
    }
    getInputIndexBySortedIndex(index) {
        return this.sortedIndexToInputIndexMap.get(index);
    }
    getSortedIndexById(id) {
        return id !== undefined ? this.idToSortedIndexMap.get(id) : undefined;
    }
    getAdjacentNodes(id) {
        var _a, _b;
        const index = this.getSortedIndexById(id);
        if (index === undefined)
            return undefined;
        const outgoingSet = (_a = this.groupedSourceToTargetLinks.get(index)) !== null && _a !== void 0 ? _a : [];
        const incomingSet = (_b = this.groupedTargetToSourceLinks.get(index)) !== null && _b !== void 0 ? _b : [];
        return [...new Set([...outgoingSet, ...incomingSet])]
            .map(index => this.getNodeByIndex(this.getInputIndexBySortedIndex(index)));
    }
}

var drawStraightFrag = "precision highp float;\n#define GLSLIFY 1\nuniform bool useArrow;varying vec4 rgbaColor;varying vec2 pos;varying float arrowLength;varying float linkWidthArrowWidthRatio;varying float smoothWidthRatio;varying float targetPointSize;float map(float value,float min1,float max1,float min2,float max2){return min2+(value-min1)*(max2-min2)/(max1-min1);}void main(){float opacity=1.0;vec3 color=rgbaColor.rgb;float smoothDelta=smoothWidthRatio/2.0;if(useArrow){float end_arrow=0.5+arrowLength/2.0;float start_arrow=end_arrow-arrowLength;float arrowWidthDelta=linkWidthArrowWidthRatio/2.0;float linkOpacity=rgbaColor.a*smoothstep(0.5-arrowWidthDelta,0.5-arrowWidthDelta-smoothDelta,abs(pos.y));float arrowOpacity=1.0;if(pos.x>start_arrow&&pos.x<start_arrow+arrowLength){float xmapped=map(pos.x,start_arrow,end_arrow,0.0,1.0);arrowOpacity=rgbaColor.a*smoothstep(xmapped-smoothDelta,xmapped,map(abs(pos.y),0.5,0.0,0.0,1.0));if(linkOpacity!=arrowOpacity){linkOpacity+=arrowOpacity;}}opacity=linkOpacity;}else opacity=rgbaColor.a*smoothstep(0.5,0.5-smoothDelta,abs(pos.y));gl_FragColor=vec4(color,opacity);}"; // eslint-disable-line

var drawStraightVert = "precision highp float;\n#define GLSLIFY 1\nattribute vec2 position,pointA,pointB;attribute vec4 color;attribute float width;uniform sampler2D positions;uniform sampler2D particleSize;uniform sampler2D particleGreyoutStatus;uniform mat3 transform;uniform float pointsTextureSize;uniform float widthScale;uniform float nodeSizeScale;uniform bool useArrow;uniform float arrowSizeScale;uniform float spaceSize;uniform vec2 screenSize;uniform float ratio;uniform vec2 linkVisibilityDistanceRange;uniform float linkVisibilityMinTransparency;uniform float greyoutOpacity;uniform bool scaleNodesOnZoom;varying vec4 rgbaColor;varying vec2 pos;varying float arrowLength;varying float linkWidthArrowWidthRatio;varying float smoothWidthRatio;varying float targetPointSize;float map(float value,float min1,float max1,float min2,float max2){return min2+(value-min1)*(max2-min2)/(max1-min1);}float pointSize(float size){float pSize;if(scaleNodesOnZoom){pSize=size*ratio*transform[0][0];}else{pSize=size*ratio*min(5.0,max(1.0,transform[0][0]*0.01));}return pSize;}void main(){pos=position;vec2 pointTexturePosA=(pointA+0.5)/pointsTextureSize;vec2 pointTexturePosB=(pointB+0.5)/pointsTextureSize;vec4 greyoutStatusA=texture2D(particleGreyoutStatus,pointTexturePosA);vec4 greyoutStatusB=texture2D(particleGreyoutStatus,pointTexturePosB);targetPointSize=pointSize(texture2D(particleSize,pointTexturePosB).r*nodeSizeScale);vec4 pointPositionA=texture2D(positions,pointTexturePosA);vec4 pointPositionB=texture2D(positions,pointTexturePosB);vec2 a=pointPositionA.xy;vec2 b=pointPositionB.xy;vec2 xBasis=b-a;vec2 yBasis=normalize(vec2(-xBasis.y,xBasis.x));vec2 distVector=a-b;float linkDist=sqrt(dot(distVector,distVector));float linkDistPx=linkDist*transform[0][0];targetPointSize=(targetPointSize/(2.0*ratio))/linkDistPx;float linkWidth=width*widthScale;float k=2.0;float arrowWidth=max(5.0,linkWidth*k);arrowWidth*=arrowSizeScale;float arrowWidthPx=arrowWidth/transform[0][0];arrowLength=min(0.3,(0.866*arrowWidthPx*2.0)/linkDist);float smoothWidth=2.0;float arrowExtraWidth=arrowWidth-linkWidth;linkWidth+=smoothWidth/2.0;if(useArrow){linkWidth+=arrowExtraWidth;}smoothWidthRatio=smoothWidth/linkWidth;linkWidthArrowWidthRatio=arrowExtraWidth/linkWidth;float linkWidthPx=linkWidth/transform[0][0];vec3 rgbColor=color.rgb;float opacity=color.a*max(linkVisibilityMinTransparency,map(linkDistPx,linkVisibilityDistanceRange.g,linkVisibilityDistanceRange.r,0.0,1.0));if(greyoutStatusA.r>0.0||greyoutStatusB.r>0.0){opacity*=greyoutOpacity;}rgbaColor=vec4(rgbColor,opacity);vec2 point=a+xBasis*position.x+yBasis*linkWidthPx*position.y;vec2 p=2.0*point/spaceSize-1.0;p*=spaceSize/screenSize;vec3 final=transform*vec3(p,1);gl_Position=vec4(final.rg,0,1);}"; // eslint-disable-line

class Lines extends CoreModule {
    create() {
        this.updateColor();
        this.updateWidth();
    }
    initPrograms() {
        const { reglInstance, config, store, data, points } = this;
        const { pointsTextureSize } = store;
        const geometryLinkBuffer = {
            buffer: reglInstance.buffer([
                [0, -0.5],
                [1, -0.5],
                [1, 0.5],
                [0, -0.5],
                [1, 0.5],
                [0, 0.5],
            ]),
            divisor: 0,
        };
        const instancePoints = [];
        data.completeLinks.forEach(l => {
            const toIndex = data.getSortedIndexById(l.target);
            const fromIndex = data.getSortedIndexById(l.source);
            const fromX = fromIndex % pointsTextureSize;
            const fromY = Math.floor(fromIndex / pointsTextureSize);
            const toX = toIndex % pointsTextureSize;
            const toY = Math.floor(toIndex / pointsTextureSize);
            instancePoints.push([fromX, fromY]);
            instancePoints.push([toX, toY]);
        });
        const pointsBuffer = reglInstance.buffer(instancePoints);
        this.drawStraightCommand = reglInstance({
            vert: drawStraightVert,
            frag: drawStraightFrag,
            attributes: {
                position: geometryLinkBuffer,
                pointA: {
                    buffer: () => pointsBuffer,
                    divisor: 1,
                    offset: Float32Array.BYTES_PER_ELEMENT * 0,
                    stride: Float32Array.BYTES_PER_ELEMENT * 4,
                },
                pointB: {
                    buffer: () => pointsBuffer,
                    divisor: 1,
                    offset: Float32Array.BYTES_PER_ELEMENT * 2,
                    stride: Float32Array.BYTES_PER_ELEMENT * 4,
                },
                color: {
                    buffer: () => this.colorBuffer,
                    divisor: 1,
                    offset: Float32Array.BYTES_PER_ELEMENT * 0,
                    stride: Float32Array.BYTES_PER_ELEMENT * 4,
                },
                width: {
                    buffer: () => this.widthBuffer,
                    divisor: 1,
                    offset: Float32Array.BYTES_PER_ELEMENT * 0,
                    stride: Float32Array.BYTES_PER_ELEMENT * 1,
                },
            },
            uniforms: {
                positions: () => points === null || points === void 0 ? void 0 : points.currentPositionFbo,
                particleSize: () => points === null || points === void 0 ? void 0 : points.sizeFbo,
                particleGreyoutStatus: () => points === null || points === void 0 ? void 0 : points.greyoutStatusFbo,
                transform: () => store.transform,
                pointsTextureSize: () => store.pointsTextureSize,
                nodeSizeScale: () => config.nodeSizeScale,
                widthScale: () => config.linkWidthScale,
                useArrow: () => config.linkArrows,
                arrowSizeScale: () => config.linkArrowsSizeScale,
                spaceSize: () => config.spaceSize,
                screenSize: () => store.screenSize,
                ratio: () => config.pixelRatio,
                linkVisibilityDistanceRange: () => config.linkVisibilityDistanceRange,
                linkVisibilityMinTransparency: () => config.linkVisibilityMinTransparency,
                greyoutOpacity: () => config.linkGreyoutOpacity,
                scaleNodesOnZoom: () => config.scaleNodesOnZoom,
            },
            cull: {
                enable: true,
                face: 'back',
            },
            blend: {
                enable: true,
                func: {
                    dstRGB: 'one minus src alpha',
                    srcRGB: 'src alpha',
                    dstAlpha: 'one minus src alpha',
                    srcAlpha: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: {
                enable: false,
                mask: false,
            },
            count: 6,
            instances: () => data.linksNumber,
        });
    }
    draw() {
        var _a;
        if (!this.colorBuffer || !this.widthBuffer)
            return;
        (_a = this.drawStraightCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    updateColor() {
        const { reglInstance, config, data } = this;
        const instancePoints = [];
        data.completeLinks.forEach(l => {
            var _a;
            const c = (_a = getValue(l, config.linkColor)) !== null && _a !== void 0 ? _a : defaultLinkColor;
            const rgba = getRgbaColor(c);
            instancePoints.push(rgba);
        });
        this.colorBuffer = reglInstance.buffer(instancePoints);
    }
    updateWidth() {
        const { reglInstance, config, data } = this;
        const instancePoints = [];
        data.completeLinks.forEach(l => {
            const linkWidth = getValue(l, config.linkWidth);
            instancePoints.push([linkWidth !== null && linkWidth !== void 0 ? linkWidth : defaultLinkWidth]);
        });
        this.widthBuffer = reglInstance.buffer(instancePoints);
    }
    destroy() {
        destroyBuffer(this.colorBuffer);
        destroyBuffer(this.widthBuffer);
    }
}

function createColorBuffer(data, reglInstance, textureSize, colorAccessor) {
    var _a;
    const initialState = new Float32Array(textureSize * textureSize * 4);
    for (let i = 0; i < data.nodes.length; ++i) {
        const sortedIndex = data.getSortedIndexByInputIndex(i);
        const node = data.nodes[i];
        if (node && sortedIndex !== undefined) {
            const c = (_a = getValue(node, colorAccessor)) !== null && _a !== void 0 ? _a : defaultNodeColor;
            const rgba = getRgbaColor(c);
            initialState[sortedIndex * 4 + 0] = rgba[0];
            initialState[sortedIndex * 4 + 1] = rgba[1];
            initialState[sortedIndex * 4 + 2] = rgba[2];
            initialState[sortedIndex * 4 + 3] = rgba[3];
        }
    }
    const initialTexture = reglInstance.texture({
        data: initialState,
        width: textureSize,
        height: textureSize,
        type: 'float',
    });
    return reglInstance.framebuffer({
        color: initialTexture,
        depth: false,
        stencil: false,
    });
}
function createGreyoutStatusBuffer(selectedIndices, reglInstance, textureSize) {
    // Greyout status: 0 - false, highlighted or normal point; 1 - true, greyout point
    const initialState = new Float32Array(textureSize * textureSize * 4)
        .fill(selectedIndices ? 1 : 0);
    if (selectedIndices) {
        for (const selectedIndex of selectedIndices) {
            initialState[selectedIndex * 4] = 0;
        }
    }
    const initialTexture = reglInstance.texture({
        data: initialState,
        width: textureSize,
        height: textureSize,
        type: 'float',
    });
    return reglInstance.framebuffer({
        color: initialTexture,
        depth: false,
        stencil: false,
    });
}

var drawPointsFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nvarying vec2 index;varying vec3 rgbColor;varying float alpha;const float smoothing=0.9;void main(){if(alpha==0.0){discard;}float r=0.0;float delta=0.0;vec2 cxy=2.0*gl_PointCoord-1.0;r=dot(cxy,cxy);float opacity=alpha*(1.0-smoothstep(smoothing,1.0,r));gl_FragColor=vec4(rgbColor,opacity);}"; // eslint-disable-line

var drawPointsVert = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nattribute vec2 indexes;uniform sampler2D positions;uniform sampler2D particleColor;uniform sampler2D particleGreyoutStatus;uniform sampler2D particleSize;uniform float ratio;uniform mat3 transform;uniform float pointsTextureSize;uniform float sizeScale;uniform float spaceSize;uniform vec2 screenSize;uniform float greyoutOpacity;uniform bool scaleNodesOnZoom;varying vec2 index;varying vec3 rgbColor;varying float alpha;float pointSize(float size){float pSize;if(scaleNodesOnZoom){pSize=size*ratio*transform[0][0];}else{pSize=size*ratio*min(5.0,max(1.0,transform[0][0]*0.01));}return pSize;}void main(){index=indexes;vec4 pointPosition=texture2D(positions,(index+0.5)/pointsTextureSize);vec2 point=pointPosition.rg;vec2 p=2.0*point/spaceSize-1.0;p*=spaceSize/screenSize;vec3 final=transform*vec3(p,1);gl_Position=vec4(final.rg,0,1);vec4 pSize=texture2D(particleSize,(index+0.5)/pointsTextureSize);float size=pSize.r*sizeScale;vec4 pColor=texture2D(particleColor,(index+0.5)/pointsTextureSize);rgbColor=pColor.rgb;gl_PointSize=pointSize(size);alpha=pColor.a;vec4 greyoutStatus=texture2D(particleGreyoutStatus,(index+0.5)/pointsTextureSize);if(greyoutStatus.r>0.0){alpha*=greyoutOpacity;}}"; // eslint-disable-line

var findPointsOnAreaSelectionFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D particleSize;uniform float sizeScale;uniform float spaceSize;uniform vec2 screenSize;uniform float ratio;uniform mat3 transform;uniform vec2 selection[2];uniform bool scaleNodesOnZoom;uniform float maxPointSize;varying vec2 index;float pointSize(float size){float pSize;if(scaleNodesOnZoom){pSize=size*ratio*transform[0][0];}else{pSize=size*ratio*min(5.0,max(1.0,transform[0][0]*0.01));}return min(pSize,maxPointSize);}void main(){vec4 pointPosition=texture2D(position,index);vec2 p=2.0*pointPosition.rg/spaceSize-1.0;p*=spaceSize/screenSize;vec3 final=transform*vec3(p,1);vec4 pSize=texture2D(particleSize,index);float size=pSize.r*sizeScale;float left=2.0*(selection[0].x-0.5*pointSize(size))/screenSize.x-1.0;float right=2.0*(selection[1].x+0.5*pointSize(size))/screenSize.x-1.0;float top=2.0*(selection[0].y-0.5*pointSize(size))/screenSize.y-1.0;float bottom=2.0*(selection[1].y+0.5*pointSize(size))/screenSize.y-1.0;gl_FragColor=vec4(0.0,0.0,pointPosition.rg);if(final.x>=left&&final.x<=right&&final.y>=top&&final.y<=bottom){gl_FragColor.r=1.0;}}"; // eslint-disable-line

var drawHighlightedFrag = "precision mediump float;\n#define GLSLIFY 1\nuniform vec4 color;uniform float width;varying vec2 pos;varying float particleOpacity;const float smoothing=1.05;void main(){vec2 cxy=pos;float r=dot(cxy,cxy);float opacity=smoothstep(r,r*smoothing,1.0);float stroke=smoothstep(width,width*smoothing,r);gl_FragColor=vec4(color.rgb,opacity*stroke*color.a*particleOpacity);}"; // eslint-disable-line

var drawHighlightedVert = "precision mediump float;\n#define GLSLIFY 1\nattribute vec2 quad;uniform sampler2D positions;uniform sampler2D particleColor;uniform sampler2D particleGreyoutStatus;uniform sampler2D particleSize;uniform mat3 transform;uniform float pointsTextureSize;uniform float sizeScale;uniform float spaceSize;uniform vec2 screenSize;uniform bool scaleNodesOnZoom;uniform float pointIndex;uniform float maxPointSize;uniform vec4 color;uniform float greyoutOpacity;varying vec2 pos;varying float particleOpacity;float pointSize(float size){float pSize;if(scaleNodesOnZoom){pSize=size*transform[0][0];}else{pSize=size*min(5.0,max(1.0,transform[0][0]*0.01));}return min(pSize,maxPointSize);}const float relativeRingRadius=1.3;void main(){pos=quad;vec2 ij=vec2(mod(pointIndex,pointsTextureSize),floor(pointIndex/pointsTextureSize))+0.5;vec4 pointPosition=texture2D(positions,ij/pointsTextureSize);vec4 pSize=texture2D(particleSize,ij/pointsTextureSize);vec4 pColor=texture2D(particleColor,ij/pointsTextureSize);particleOpacity=pColor.a;vec4 greyoutStatus=texture2D(particleGreyoutStatus,ij/pointsTextureSize);if(greyoutStatus.r>0.0){particleOpacity*=greyoutOpacity;}float size=(pointSize(pSize.r*sizeScale)*relativeRingRadius)/transform[0][0];float radius=size*0.5;vec2 a=pointPosition.xy;vec2 b=pointPosition.xy+vec2(0.0,radius);vec2 xBasis=b-a;vec2 yBasis=normalize(vec2(-xBasis.y,xBasis.x));vec2 point=a+xBasis*quad.x+yBasis*radius*quad.y;vec2 p=2.0*point/spaceSize-1.0;p*=spaceSize/screenSize;vec3 final=transform*vec3(p,1);gl_Position=vec4(final.rg,0,1);}"; // eslint-disable-line

var findHoveredPointFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nvarying vec4 rgba;void main(){gl_FragColor=rgba;}"; // eslint-disable-line

var findHoveredPointVert = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform float pointsTextureSize;uniform sampler2D particleSize;uniform float sizeScale;uniform float spaceSize;uniform vec2 screenSize;uniform float ratio;uniform mat3 transform;uniform vec2 mousePosition;uniform bool scaleNodesOnZoom;uniform float maxPointSize;attribute vec2 indexes;varying vec4 rgba;float pointSize(float size){float pSize;if(scaleNodesOnZoom){pSize=size*ratio*transform[0][0];}else{pSize=size*ratio*min(5.0,max(1.0,transform[0][0]*0.01));}return min(pSize,maxPointSize);}float euclideanDistance(float x1,float x2,float y1,float y2){return sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));}void main(){vec4 pointPosition=texture2D(position,(indexes+0.5)/pointsTextureSize);vec2 p=2.0*pointPosition.rg/spaceSize-1.0;p*=spaceSize/screenSize;vec3 final=transform*vec3(p,1);vec4 pSize=texture2D(particleSize,indexes/pointsTextureSize);float size=pSize.r*sizeScale;float pointRadius=0.5*pointSize(size);vec2 pointScreenPosition=(final.xy+1.0)*screenSize/2.0;rgba=vec4(0.0);gl_Position=vec4(0.5,0.5,0.0,1.0);if(euclideanDistance(pointScreenPosition.x,mousePosition.x,pointScreenPosition.y,mousePosition.y)<pointRadius){float index=indexes.g*pointsTextureSize+indexes.r;rgba=vec4(index,pSize.r,pointPosition.xy);gl_Position=vec4(-0.5,-0.5,0.0,1.0);}gl_PointSize=1.0;}"; // eslint-disable-line

function getNodeSize(node, sizeAccessor) {
    const size = getValue(node, sizeAccessor);
    return size !== null && size !== void 0 ? size : defaultNodeSize;
}
function createSizeBuffer(data, reglInstance, pointTextureSize, sizeAccessor) {
    const numParticles = data.nodes.length;
    const initialState = new Float32Array(pointTextureSize * pointTextureSize * 4);
    for (let i = 0; i < numParticles; ++i) {
        const sortedIndex = data.getSortedIndexByInputIndex(i);
        const node = data.nodes[i];
        if (node && sortedIndex !== undefined) {
            initialState[sortedIndex * 4] = getNodeSize(node, sizeAccessor);
        }
    }
    const initialTexture = reglInstance.texture({
        data: initialState,
        width: pointTextureSize,
        height: pointTextureSize,
        type: 'float',
    });
    return reglInstance.framebuffer({
        color: initialTexture,
        depth: false,
        stencil: false,
    });
}

var updatePositionFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D velocity;uniform float friction;uniform float spaceSize;varying vec2 index;void main(){vec4 pointPosition=texture2D(position,index);vec4 pointVelocity=texture2D(velocity,index);pointVelocity.rg*=friction;pointPosition.rg+=pointVelocity.rg;pointPosition.r=clamp(pointPosition.r,0.0,spaceSize);pointPosition.g=clamp(pointPosition.g,0.0,spaceSize);gl_FragColor=pointPosition;}"; // eslint-disable-line

function createTrackedPositionsBuffer(indices, reglInstance) {
    const size = Math.ceil(Math.sqrt(indices.length));
    return reglInstance.framebuffer({
        shape: [size, size],
        depth: false,
        stencil: false,
        colorType: 'float',
    });
}
function createTrackedIndicesBuffer(indices, pointsTextureSize, reglInstance) {
    const size = Math.ceil(Math.sqrt(indices.length));
    const initialState = new Float32Array(size * size * 4).fill(-1);
    for (const [i, sortedIndex] of indices.entries()) {
        if (sortedIndex !== undefined) {
            initialState[i * 4] = sortedIndex % pointsTextureSize;
            initialState[i * 4 + 1] = Math.floor(sortedIndex / pointsTextureSize);
            initialState[i * 4 + 2] = 0;
            initialState[i * 4 + 3] = 0;
        }
    }
    const initialTexture = reglInstance.texture({
        data: initialState,
        width: size,
        height: size,
        type: 'float',
    });
    return reglInstance.framebuffer({
        color: initialTexture,
        depth: false,
        stencil: false,
    });
}

var trackPositionsFrag = "#ifdef GL_ES\nprecision highp float;\n#define GLSLIFY 1\n#endif\nuniform sampler2D position;uniform sampler2D trackedIndices;uniform float pointsTextureSize;varying vec2 index;void main(){vec4 trackedPointIndicies=texture2D(trackedIndices,index);if(trackedPointIndicies.r<0.0)discard;vec4 pointPosition=texture2D(position,(trackedPointIndicies.rg+0.5)/pointsTextureSize);gl_FragColor=vec4(pointPosition.rg,1.0,1.0);}"; // eslint-disable-line

class Points extends CoreModule {
    constructor() {
        super(...arguments);
        this.trackedPositionsById = new Map();
    }
    create() {
        var _a, _b;
        const { reglInstance, config, store, data } = this;
        const { spaceSize } = config;
        const { pointsTextureSize } = store;
        const numParticles = data.nodes.length;
        const initialState = new Float32Array(pointsTextureSize * pointsTextureSize * 4);
        for (let i = 0; i < numParticles; ++i) {
            const sortedIndex = this.data.getSortedIndexByInputIndex(i);
            const node = data.nodes[i];
            if (node && sortedIndex !== undefined) {
                const space = spaceSize !== null && spaceSize !== void 0 ? spaceSize : defaultConfigValues.spaceSize;
                initialState[sortedIndex * 4 + 0] = (_a = node.x) !== null && _a !== void 0 ? _a : space * store.getRandomFloat(0.495, 0.505);
                initialState[sortedIndex * 4 + 1] = (_b = node.y) !== null && _b !== void 0 ? _b : space * store.getRandomFloat(0.495, 0.505);
            }
        }
        // Create position buffer
        this.currentPositionFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: initialState,
                shape: [pointsTextureSize, pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        this.previousPositionFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: initialState,
                shape: [pointsTextureSize, pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        // Create velocity buffer
        this.velocityFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: new Float32Array(pointsTextureSize * pointsTextureSize * 4).fill(0),
                shape: [pointsTextureSize, pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        // Create selected points buffer
        this.selectedFbo = reglInstance.framebuffer({
            color: reglInstance.texture({
                data: initialState,
                shape: [pointsTextureSize, pointsTextureSize, 4],
                type: 'float',
            }),
            depth: false,
            stencil: false,
        });
        this.hoveredFbo = reglInstance.framebuffer({
            shape: [2, 2],
            colorType: 'float',
            depth: false,
            stencil: false,
        });
        this.updateSize();
        this.updateColor();
        this.updateGreyoutStatus();
    }
    initPrograms() {
        const { reglInstance, config, store, data } = this;
        this.updatePositionCommand = reglInstance({
            frag: updatePositionFrag,
            vert: updateVert,
            framebuffer: () => this.currentPositionFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => this.previousPositionFbo,
                velocity: () => this.velocityFbo,
                friction: () => { var _a; return (_a = config.simulation) === null || _a === void 0 ? void 0 : _a.friction; },
                spaceSize: () => config.spaceSize,
            },
        });
        this.drawCommand = reglInstance({
            frag: drawPointsFrag,
            vert: drawPointsVert,
            primitive: 'points',
            count: () => data.nodes.length,
            attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
            uniforms: {
                positions: () => this.currentPositionFbo,
                particleColor: () => this.colorFbo,
                particleGreyoutStatus: () => this.greyoutStatusFbo,
                particleSize: () => this.sizeFbo,
                ratio: () => config.pixelRatio,
                sizeScale: () => config.nodeSizeScale,
                pointsTextureSize: () => store.pointsTextureSize,
                transform: () => store.transform,
                spaceSize: () => config.spaceSize,
                screenSize: () => store.screenSize,
                greyoutOpacity: () => config.nodeGreyoutOpacity,
                scaleNodesOnZoom: () => config.scaleNodesOnZoom,
            },
            blend: {
                enable: true,
                func: {
                    dstRGB: 'one minus src alpha',
                    srcRGB: 'src alpha',
                    dstAlpha: 'one minus src alpha',
                    srcAlpha: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: {
                enable: false,
                mask: false,
            },
        });
        this.findPointsOnAreaSelectionCommand = reglInstance({
            frag: findPointsOnAreaSelectionFrag,
            vert: updateVert,
            framebuffer: () => this.selectedFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => this.currentPositionFbo,
                particleSize: () => this.sizeFbo,
                spaceSize: () => config.spaceSize,
                screenSize: () => store.screenSize,
                sizeScale: () => config.nodeSizeScale,
                transform: () => store.transform,
                ratio: () => config.pixelRatio,
                'selection[0]': () => store.selectedArea[0],
                'selection[1]': () => store.selectedArea[1],
                scaleNodesOnZoom: () => config.scaleNodesOnZoom,
                maxPointSize: () => store.maxPointSize,
            },
        });
        this.clearHoveredFboCommand = reglInstance({
            frag: clearFrag,
            vert: updateVert,
            framebuffer: this.hoveredFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
        });
        this.findHoveredPointCommand = reglInstance({
            frag: findHoveredPointFrag,
            vert: findHoveredPointVert,
            primitive: 'points',
            count: () => data.nodes.length,
            framebuffer: () => this.hoveredFbo,
            attributes: { indexes: createIndexesBuffer(reglInstance, store.pointsTextureSize) },
            uniforms: {
                position: () => this.currentPositionFbo,
                particleSize: () => this.sizeFbo,
                ratio: () => config.pixelRatio,
                sizeScale: () => config.nodeSizeScale,
                pointsTextureSize: () => store.pointsTextureSize,
                transform: () => store.transform,
                spaceSize: () => config.spaceSize,
                screenSize: () => store.screenSize,
                scaleNodesOnZoom: () => config.scaleNodesOnZoom,
                mousePosition: () => store.screenMousePosition,
                maxPointSize: () => store.maxPointSize,
            },
            depth: {
                enable: false,
                mask: false,
            },
        });
        this.drawHighlightedCommand = reglInstance({
            frag: drawHighlightedFrag,
            vert: drawHighlightedVert,
            attributes: { quad: createQuadBuffer(reglInstance) },
            primitive: 'triangle strip',
            count: 4,
            uniforms: {
                color: reglInstance.prop('color'),
                width: reglInstance.prop('width'),
                pointIndex: reglInstance.prop('pointIndex'),
                positions: () => this.currentPositionFbo,
                particleColor: () => this.colorFbo,
                particleSize: () => this.sizeFbo,
                sizeScale: () => config.nodeSizeScale,
                pointsTextureSize: () => store.pointsTextureSize,
                transform: () => store.transform,
                spaceSize: () => config.spaceSize,
                screenSize: () => store.screenSize,
                scaleNodesOnZoom: () => config.scaleNodesOnZoom,
                maxPointSize: () => store.maxPointSize,
                particleGreyoutStatus: () => this.greyoutStatusFbo,
                greyoutOpacity: () => config.nodeGreyoutOpacity,
            },
            blend: {
                enable: true,
                func: {
                    dstRGB: 'one minus src alpha',
                    srcRGB: 'src alpha',
                    dstAlpha: 'one minus src alpha',
                    srcAlpha: 'one',
                },
                equation: {
                    rgb: 'add',
                    alpha: 'add',
                },
            },
            depth: {
                enable: false,
                mask: false,
            },
        });
        this.trackPointsCommand = reglInstance({
            frag: trackPositionsFrag,
            vert: updateVert,
            framebuffer: () => this.trackedPositionsFbo,
            primitive: 'triangle strip',
            count: 4,
            attributes: { quad: createQuadBuffer(reglInstance) },
            uniforms: {
                position: () => this.currentPositionFbo,
                trackedIndices: () => this.trackedIndicesFbo,
                pointsTextureSize: () => store.pointsTextureSize,
            },
        });
    }
    updateColor() {
        const { reglInstance, config, store, data } = this;
        this.colorFbo = createColorBuffer(data, reglInstance, store.pointsTextureSize, config.nodeColor);
    }
    updateGreyoutStatus() {
        const { reglInstance, store } = this;
        this.greyoutStatusFbo = createGreyoutStatusBuffer(store.selectedIndices, reglInstance, store.pointsTextureSize);
    }
    updateSize() {
        const { reglInstance, config, store, data } = this;
        this.sizeFbo = createSizeBuffer(data, reglInstance, store.pointsTextureSize, config.nodeSize);
    }
    trackPoints() {
        var _a;
        if (!this.trackedIndicesFbo || !this.trackedPositionsFbo)
            return;
        (_a = this.trackPointsCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    draw() {
        var _a, _b, _c;
        (_a = this.drawCommand) === null || _a === void 0 ? void 0 : _a.call(this);
        if (this.config.renderHighlightedNodeRing) {
            if (this.store.hoveredNode) {
                (_b = this.drawHighlightedCommand) === null || _b === void 0 ? void 0 : _b.call(this, {
                    width: 0.85,
                    color: this.store.hoveredNodeRingColor,
                    pointIndex: this.store.hoveredNode.index,
                });
            }
            if (this.store.focusedNode) {
                (_c = this.drawHighlightedCommand) === null || _c === void 0 ? void 0 : _c.call(this, {
                    width: 0.75,
                    color: this.store.focusedNodeRingColor,
                    pointIndex: this.store.focusedNode.index,
                });
            }
        }
    }
    updatePosition() {
        var _a;
        (_a = this.updatePositionCommand) === null || _a === void 0 ? void 0 : _a.call(this);
        this.swapFbo();
    }
    findPointsOnAreaSelection() {
        var _a;
        (_a = this.findPointsOnAreaSelectionCommand) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    findHoveredPoint() {
        var _a, _b;
        (_a = this.clearHoveredFboCommand) === null || _a === void 0 ? void 0 : _a.call(this);
        (_b = this.findHoveredPointCommand) === null || _b === void 0 ? void 0 : _b.call(this);
    }
    getNodeRadius(node) {
        const { nodeSize } = this.config;
        return getNodeSize(node, nodeSize) / 2;
    }
    trackNodesByIds(ids) {
        this.trackedIds = ids.length ? ids : undefined;
        this.trackedPositionsById.clear();
        const indices = ids.map(id => this.data.getSortedIndexById(id)).filter((d) => d !== undefined);
        destroyFramebuffer(this.trackedIndicesFbo);
        this.trackedIndicesFbo = undefined;
        destroyFramebuffer(this.trackedPositionsFbo);
        this.trackedPositionsFbo = undefined;
        if (indices.length) {
            this.trackedIndicesFbo = createTrackedIndicesBuffer(indices, this.store.pointsTextureSize, this.reglInstance);
            this.trackedPositionsFbo = createTrackedPositionsBuffer(indices, this.reglInstance);
        }
        this.trackPoints();
    }
    getTrackedPositions() {
        if (!this.trackedIds)
            return this.trackedPositionsById;
        const pixels = readPixels(this.reglInstance, this.trackedPositionsFbo);
        this.trackedIds.forEach((id, i) => {
            const x = pixels[i * 4];
            const y = pixels[i * 4 + 1];
            if (x !== undefined && y !== undefined)
                this.trackedPositionsById.set(id, [x, y]);
        });
        return this.trackedPositionsById;
    }
    destroy() {
        destroyFramebuffer(this.currentPositionFbo);
        destroyFramebuffer(this.previousPositionFbo);
        destroyFramebuffer(this.velocityFbo);
        destroyFramebuffer(this.selectedFbo);
        destroyFramebuffer(this.colorFbo);
        destroyFramebuffer(this.sizeFbo);
        destroyFramebuffer(this.greyoutStatusFbo);
        destroyFramebuffer(this.hoveredFbo);
        destroyFramebuffer(this.trackedIndicesFbo);
        destroyFramebuffer(this.trackedPositionsFbo);
    }
    swapFbo() {
        const temp = this.previousPositionFbo;
        this.previousPositionFbo = this.currentPositionFbo;
        this.currentPositionFbo = temp;
    }
}

const ALPHA_MIN = 0.001;
const MAX_POINT_SIZE = 64;
class Store {
    constructor() {
        this.pointsTextureSize = 0;
        this.linksTextureSize = 0;
        this.alpha = 1;
        this.transform = mat3.create();
        this.backgroundColor = [0, 0, 0, 0];
        this.screenSize = [0, 0];
        this.mousePosition = [0, 0];
        this.screenMousePosition = [0, 0];
        this.selectedArea = [[0, 0], [0, 0]];
        this.isSimulationRunning = false;
        this.simulationProgress = 0;
        this.selectedIndices = null;
        this.maxPointSize = MAX_POINT_SIZE;
        this.hoveredNode = undefined;
        this.focusedNode = undefined;
        this.hoveredNodeRingColor = [1, 1, 1, hoveredNodeRingOpacity];
        this.focusedNodeRingColor = [1, 1, 1, focusedNodeRingOpacity];
        this.alphaTarget = 0;
        this.scaleNodeX = scaleLinear();
        this.scaleNodeY = scaleLinear();
        this.random = new Random();
        this.alphaDecay = (decay) => 1 - Math.pow(ALPHA_MIN, 1 / decay);
    }
    addRandomSeed(seed) {
        this.random = this.random.clone(seed);
    }
    getRandomFloat(min, max) {
        return this.random.float(min, max);
    }
    updateScreenSize(width, height, spaceSize) {
        this.screenSize = [width, height];
        this.scaleNodeX
            .domain([0, spaceSize])
            .range([(width - spaceSize) / 2, (width + spaceSize) / 2]);
        this.scaleNodeY
            .domain([spaceSize, 0])
            .range([(height - spaceSize) / 2, (height + spaceSize) / 2]);
    }
    scaleX(x) {
        return this.scaleNodeX(x);
    }
    scaleY(y) {
        return this.scaleNodeY(y);
    }
    setHighlightedNodeRingColor(color) {
        const convertedRgba = getRgbaColor(color);
        this.hoveredNodeRingColor[0] = convertedRgba[0];
        this.hoveredNodeRingColor[1] = convertedRgba[1];
        this.hoveredNodeRingColor[2] = convertedRgba[2];
        this.focusedNodeRingColor[0] = convertedRgba[0];
        this.focusedNodeRingColor[1] = convertedRgba[1];
        this.focusedNodeRingColor[2] = convertedRgba[2];
    }
    setFocusedNode(node, index) {
        if (node && index !== undefined) {
            this.focusedNode = { node, index };
        }
        else
            this.focusedNode = undefined;
    }
    addAlpha(decay) {
        return (this.alphaTarget - this.alpha) * this.alphaDecay(decay);
    }
}

class Zoom {
    constructor(store, config) {
        this.eventTransform = zoomIdentity;
        this.behavior = zoom()
            .scaleExtent([0.001, Infinity])
            .on('start', (e) => {
            var _a, _b, _c;
            this.isRunning = true;
            const userDriven = !!e.sourceEvent;
            (_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onZoomStart) === null || _c === void 0 ? void 0 : _c.call(_b, e, userDriven);
        })
            .on('zoom', (e) => {
            var _a, _b, _c;
            this.eventTransform = e.transform;
            const { eventTransform: { x, y, k }, store: { transform, screenSize } } = this;
            const w = screenSize[0];
            const h = screenSize[1];
            mat3.projection(transform, w, h);
            mat3.translate(transform, transform, [x, y]);
            mat3.scale(transform, transform, [k, k]);
            mat3.translate(transform, transform, [w / 2, h / 2]);
            mat3.scale(transform, transform, [w / 2, h / 2]);
            mat3.scale(transform, transform, [1, -1]);
            const userDriven = !!e.sourceEvent;
            (_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onZoom) === null || _c === void 0 ? void 0 : _c.call(_b, e, userDriven);
        })
            .on('end', (e) => {
            var _a, _b, _c;
            this.isRunning = false;
            const userDriven = !!e.sourceEvent;
            (_c = (_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.events) === null || _b === void 0 ? void 0 : _b.onZoomEnd) === null || _c === void 0 ? void 0 : _c.call(_b, e, userDriven);
        });
        this.isRunning = false;
        this.store = store;
        this.config = config;
    }
    getTransform(positions, scale) {
        if (positions.length === 0)
            return this.eventTransform;
        const { store: { screenSize, maxPointSize } } = this;
        const width = screenSize[0];
        const height = screenSize[1];
        const xExtent = extent(positions.map(d => d[0]));
        const yExtent = extent(positions.map(d => d[1]));
        xExtent[0] = this.store.scaleX(xExtent[0] - maxPointSize / 2);
        xExtent[1] = this.store.scaleX(xExtent[1] + maxPointSize / 2);
        yExtent[0] = this.store.scaleY(yExtent[0] - maxPointSize / 2);
        yExtent[1] = this.store.scaleY(yExtent[1] + maxPointSize / 2);
        const xScale = width / (xExtent[1] - xExtent[0]);
        const yScale = height / (yExtent[0] - yExtent[1]);
        const clampedScale = clamp(scale !== null && scale !== void 0 ? scale : Math.min(xScale, yScale), ...this.behavior.scaleExtent());
        const xCenter = (xExtent[1] + xExtent[0]) / 2;
        const yCenter = (yExtent[1] + yExtent[0]) / 2;
        const translateX = width / 2 - xCenter * clampedScale;
        const translateY = height / 2 - yCenter * clampedScale;
        const transform = zoomIdentity
            .translate(translateX, translateY)
            .scale(clampedScale);
        return transform;
    }
    getDistanceToPoint(position) {
        const { x, y, k } = this.eventTransform;
        const point = this.getTransform([position], k);
        const dx = x - point.x;
        const dy = y - point.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    getMiddlePointTransform(position) {
        const { store: { screenSize }, eventTransform: { x, y, k } } = this;
        const width = screenSize[0];
        const height = screenSize[1];
        const currX = (width / 2 - x) / k;
        const currY = (height / 2 - y) / k;
        const pointX = this.store.scaleX(position[0]);
        const pointY = this.store.scaleY(position[1]);
        const centerX = (currX + pointX) / 2;
        const centerY = (currY + pointY) / 2;
        const scale = 1;
        const translateX = width / 2 - centerX * scale;
        const translateY = height / 2 - centerY * scale;
        return zoomIdentity
            .translate(translateX, translateY)
            .scale(scale);
    }
    convertSpaceToScreenPosition(spacePosition) {
        const screenPointX = this.eventTransform.applyX(this.store.scaleX(spacePosition[0]));
        const screenPointY = this.eventTransform.applyY(this.store.scaleY(spacePosition[1]));
        return [screenPointX, screenPointY];
    }
    convertSpaceToScreenRadius(spaceRadius) {
        const { config: { scaleNodesOnZoom }, store: { maxPointSize }, eventTransform: { k } } = this;
        let size = spaceRadius * 2;
        if (scaleNodesOnZoom) {
            size *= k;
        }
        else {
            size *= Math.min(5.0, Math.max(1.0, k * 0.01));
        }
        return Math.min(size, maxPointSize) / 2;
    }
}

class Graph {
    constructor(canvas, config) {
        var _a;
        this.config = new GraphConfig();
        this.requestAnimationFrameId = 0;
        this.isRightClickMouse = false;
        this.graph = new GraphData();
        this.store = new Store();
        this.zoomInstance = new Zoom(this.store, this.config);
        this.hasBeenRecentlyDestroyed = false;
        if (config)
            this.config.init(config);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        this.store.updateScreenSize(w, h, this.config.spaceSize);
        canvas.width = w * this.config.pixelRatio;
        canvas.height = h * this.config.pixelRatio;
        // If the canvas element has no CSS width and height style, the clientWidth and the clientHeight will always
        // be equal to the width and height canvas attribute.
        // In order to prevent resize problem assume that canvas CSS style width and height has a value of 100%.
        if (canvas.style.width === '' && canvas.style.height === '') {
            select(canvas)
                .style('width', '100%')
                .style('height', '100%');
        }
        this.canvas = canvas;
        this.canvasD3Selection = select(canvas);
        this.zoomInstance.behavior
            .on('start.detect', (e) => { this.currentEvent = e; })
            .on('zoom.detect', (e) => {
            const userDriven = !!e.sourceEvent;
            if (userDriven)
                this.updateMousePosition(e.sourceEvent);
            this.currentEvent = e;
        })
            .on('end.detect', (e) => { this.currentEvent = e; });
        this.canvasD3Selection
            .call(this.zoomInstance.behavior)
            .on('click', this.onClick.bind(this))
            .on('mousemove', this.onMouseMove.bind(this))
            .on('contextmenu', this.onRightClickMouse.bind(this));
        this.reglInstance = regl({
            canvas: this.canvas,
            attributes: {
                antialias: false,
                preserveDrawingBuffer: true,
                premultipliedAlpha: false,
                alpha: false,
            },
            extensions: ['OES_texture_float', 'ANGLE_instanced_arrays'],
        });
        this.store.maxPointSize = ((_a = this.reglInstance.limits.pointSizeDims[1]) !== null && _a !== void 0 ? _a : MAX_POINT_SIZE) / this.config.pixelRatio;
        this.points = new Points(this.reglInstance, this.config, this.store, this.graph);
        this.lines = new Lines(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceGravity = new ForceGravity(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceCenter = new ForceCenter(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceManyBody = this.config.useQuadtree
            ? new ForceManyBodyQuadtree(this.reglInstance, this.config, this.store, this.graph, this.points)
            : new ForceManyBody(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceLinkIncoming = new ForceLink(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceLinkOutgoing = new ForceLink(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.forceMouse = new ForceMouse(this.reglInstance, this.config, this.store, this.graph, this.points);
        this.store.backgroundColor = getRgbaColor(this.config.backgroundColor);
        if (this.config.highlightedNodeRingColor)
            this.store.setHighlightedNodeRingColor(this.config.highlightedNodeRingColor);
        if (this.config.showFPSMonitor)
            this.fpsMonitor = new FPSMonitor(this.canvas);
        if (this.config.randomSeed !== undefined)
            this.store.addRandomSeed(this.config.randomSeed);
    }
    get progress() {
        return this.store.simulationProgress;
    }
    /**
     * A value that gives information about the running simulation status.
     */
    get isSimulationRunning() {
        return this.store.isSimulationRunning;
    }
    /**
     * The maximum point size.
     * This value is the maximum size of the `gl.POINTS` primitive that WebGL can render on the user's hardware.
     */
    get maxPointSize() {
        return this.store.maxPointSize;
    }
    /**
     * Set or update Cosmos configuration. The changes will be applied in real time.
     * @param config Cosmos configuration object.
     */
    setConfig(config) {
        var _a, _b;
        const prevConfig = { ...this.config };
        this.config.init(config);
        if (prevConfig.linkColor !== this.config.linkColor)
            this.lines.updateColor();
        if (prevConfig.nodeColor !== this.config.nodeColor)
            this.points.updateColor();
        if (prevConfig.nodeSize !== this.config.nodeSize)
            this.points.updateSize();
        if (prevConfig.linkWidth !== this.config.linkWidth)
            this.lines.updateWidth();
        if (prevConfig.backgroundColor !== this.config.backgroundColor)
            this.store.backgroundColor = getRgbaColor(this.config.backgroundColor);
        if (prevConfig.highlightedNodeRingColor !== this.config.highlightedNodeRingColor) {
            this.store.setHighlightedNodeRingColor(this.config.highlightedNodeRingColor);
        }
        if (prevConfig.spaceSize !== this.config.spaceSize ||
            prevConfig.simulation.repulsionQuadtreeLevels !== this.config.simulation.repulsionQuadtreeLevels)
            this.update(this.store.isSimulationRunning);
        if (prevConfig.showFPSMonitor !== this.config.showFPSMonitor) {
            if (this.config.showFPSMonitor) {
                this.fpsMonitor = new FPSMonitor(this.canvas);
            }
            else {
                (_a = this.fpsMonitor) === null || _a === void 0 ? void 0 : _a.destroy();
                this.fpsMonitor = undefined;
            }
        }
        if (prevConfig.pixelRatio !== this.config.pixelRatio) {
            this.store.maxPointSize = ((_b = this.reglInstance.limits.pointSizeDims[1]) !== null && _b !== void 0 ? _b : MAX_POINT_SIZE) / this.config.pixelRatio;
        }
    }
    /**
     * Pass data to Cosmos.
     * @param nodes Array of nodes.
     * @param links Array of links.
     * @param runSimulation When set to `false`, the simulation won't be started automatically (`true` by default).
     */
    setData(nodes, links, runSimulation = true) {
        if (!nodes.length && !links.length) {
            this.destroy();
            this.reglInstance.clear({
                color: this.store.backgroundColor,
                depth: 1,
                stencil: 0,
            });
            return;
        }
        this.graph.setData(nodes, links);
        this.update(runSimulation);
    }
    /**
     * Center the view on a node and zoom in, by node id.
     * @param id Id of the node.
     * @param duration Duration of the animation transition in milliseconds (`700` by default).
     * @param scale Scale value to zoom in or out (`3` by default).
     * @param canZoomOut Set to `false` to prevent zooming out from the node (`true` by default).
     */
    zoomToNodeById(id, duration = 700, scale = defaultScaleToZoom, canZoomOut = true) {
        const node = this.graph.getNodeById(id);
        if (!node)
            return;
        this.zoomToNode(node, duration, scale, canZoomOut);
    }
    /**
     * Center the view on a node and zoom in, by node index.
     * @param index The index of the node in the array of nodes.
     * @param duration Duration of the animation transition in milliseconds (`700` by default).
     * @param scale Scale value to zoom in or out (`3` by default).
     * @param canZoomOut Set to `false` to prevent zooming out from the node (`true` by default).
     */
    zoomToNodeByIndex(index, duration = 700, scale = defaultScaleToZoom, canZoomOut = true) {
        const node = this.graph.getNodeByIndex(index);
        if (!node)
            return;
        this.zoomToNode(node, duration, scale, canZoomOut);
    }
    /**
     * Zoom the view in or out to the specified zoom level.
     * @param value Zoom level
     * @param duration Duration of the zoom in/out transition.
     */
    zoom(value, duration = 0) {
        this.setZoomLevel(value, duration);
    }
    /**
     * Zoom the view in or out to the specified zoom level.
     * @param value Zoom level
     * @param duration Duration of the zoom in/out transition.
     */
    setZoomLevel(value, duration = 0) {
        this.canvasD3Selection
            .transition()
            .duration(duration)
            .call(this.zoomInstance.behavior.scaleTo, value);
    }
    /**
     * Get zoom level.
     * @returns Zoom level value of the view.
     */
    getZoomLevel() {
        return this.zoomInstance.eventTransform.k;
    }
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns Object where keys are the ids of the nodes and values are corresponding `{ x: number; y: number }` objects.
     */
    getNodePositions() {
        if (this.hasBeenRecentlyDestroyed)
            return {};
        const particlePositionPixels = readPixels(this.reglInstance, this.points.currentPositionFbo);
        return this.graph.nodes.reduce((acc, curr) => {
            const index = this.graph.getSortedIndexById(curr.id);
            const posX = particlePositionPixels[index * 4 + 0];
            const posY = particlePositionPixels[index * 4 + 1];
            if (posX !== undefined && posY !== undefined) {
                acc[curr.id] = {
                    x: posX,
                    y: posY,
                };
            }
            return acc;
        }, {});
    }
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns A Map object where keys are the ids of the nodes and values are their corresponding X and Y coordinates in the [number, number] format.
     */
    getNodePositionsMap() {
        const positionMap = new Map();
        if (this.hasBeenRecentlyDestroyed)
            return positionMap;
        const particlePositionPixels = readPixels(this.reglInstance, this.points.currentPositionFbo);
        return this.graph.nodes.reduce((acc, curr) => {
            const index = this.graph.getSortedIndexById(curr.id);
            const posX = particlePositionPixels[index * 4 + 0];
            const posY = particlePositionPixels[index * 4 + 1];
            if (posX !== undefined && posY !== undefined) {
                acc.set(curr.id, [posX, posY]);
            }
            return acc;
        }, positionMap);
    }
    /**
     * Get current X and Y coordinates of the nodes.
     * @returns Array of `[x: number, y: number]` arrays.
     */
    getNodePositionsArray() {
        const positions = [];
        if (this.hasBeenRecentlyDestroyed)
            return [];
        const particlePositionPixels = readPixels(this.reglInstance, this.points.currentPositionFbo);
        positions.length = this.graph.nodes.length;
        for (let i = 0; i < this.graph.nodes.length; i += 1) {
            const index = this.graph.getSortedIndexByInputIndex(i);
            const posX = particlePositionPixels[index * 4 + 0];
            const posY = particlePositionPixels[index * 4 + 1];
            if (posX !== undefined && posY !== undefined) {
                positions[i] = [posX, posY];
            }
        }
        return positions;
    }
    /**
     * Center and zoom in/out the view to fit all nodes in the scene.
     * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
     */
    fitView(duration = 250) {
        this.setZoomTransformByNodePositions(this.getNodePositionsArray(), duration);
    }
    /**
     * Center and zoom in/out the view to fit nodes by their ids in the scene.
     * @param duration Duration of the center and zoom in/out animation in milliseconds (`250` by default).
     */
    fitViewByNodeIds(ids, duration = 250) {
        const positionsMap = this.getNodePositionsMap();
        const positions = ids.map(id => positionsMap.get(id)).filter((d) => d !== undefined);
        this.setZoomTransformByNodePositions(positions, duration);
    }
    /** Select nodes inside a rectangular area.
     * @param selection - Array of two corner points `[[left, top], [right, bottom]]`.
     * The `left` and `right` coordinates should be from 0 to the width of the canvas.
     * The `top` and `bottom` coordinates should be from 0 to the height of the canvas. */
    selectNodesInRange(selection) {
        if (selection) {
            const h = this.store.screenSize[1];
            this.store.selectedArea = [[selection[0][0], (h - selection[1][1])], [selection[1][0], (h - selection[0][1])]];
            this.points.findPointsOnAreaSelection();
            const pixels = readPixels(this.reglInstance, this.points.selectedFbo);
            this.store.selectedIndices = pixels
                .map((pixel, i) => {
                if (i % 4 === 0 && pixel !== 0)
                    return i / 4;
                else
                    return -1;
            })
                .filter(d => d !== -1);
        }
        else {
            this.store.selectedIndices = null;
        }
        this.store.setFocusedNode();
        this.points.updateGreyoutStatus();
    }
    /**
     * Select a node by id. If you want the adjacent nodes to get selected too, provide `true` as the second argument.
     * @param id Id of the node.
     * @param selectAdjacentNodes When set to `true`, selects adjacent nodes (`false` by default).
     */
    selectNodeById(id, selectAdjacentNodes = false) {
        var _a;
        if (selectAdjacentNodes) {
            const adjacentNodes = (_a = this.graph.getAdjacentNodes(id)) !== null && _a !== void 0 ? _a : [];
            this.selectNodesByIds([id, ...adjacentNodes.map(d => d.id)]);
        }
        else
            this.selectNodesByIds([id]);
        this.store.setFocusedNode(this.graph.getNodeById(id), this.graph.getSortedIndexById(id));
    }
    /**
     * Select a node by index. If you want the adjacent nodes to get selected too, provide `true` as the second argument.
     * @param index The index of the node in the array of nodes.
     * @param selectAdjacentNodes When set to `true`, selects adjacent nodes (`false` by default).
     */
    selectNodeByIndex(index, selectAdjacentNodes = false) {
        const node = this.graph.getNodeByIndex(index);
        if (node)
            this.selectNodeById(node.id, selectAdjacentNodes);
    }
    /**
     * Select multiples nodes by their ids.
     * @param ids Array of nodes ids.
     */
    selectNodesByIds(ids, focusedNodeId) {
        this.selectNodesByIndices(ids === null || ids === void 0 ? void 0 : ids.map(d => this.graph.getSortedIndexById(d)), this.graph.getSortedIndexById(focusedNodeId));
    }
    /**
     * Select multiples nodes by their indices.
     * @param indices Array of nodes indices.
     */
    selectNodesByIndices(indices, focusedNodeIndex) {
        if (!indices) {
            this.store.selectedIndices = null;
        }
        else if (indices.length === 0) {
            this.store.selectedIndices = new Float32Array();
        }
        else {
            this.store.selectedIndices = new Float32Array(indices.filter((d) => d !== undefined));
        }
        this.store.setFocusedNode();
        this.points.updateGreyoutStatus();
        if (focusedNodeIndex !== undefined)
            this.store.setFocusedNode(this.graph.getNodeByIndex(focusedNodeIndex), focusedNodeIndex);
    }
    /**
     * Unselect all nodes.
     */
    unselectNodes() {
        this.store.selectedIndices = null;
        this.store.setFocusedNode();
        this.points.updateGreyoutStatus();
    }
    /**
     * Get nodes that are currently selected.
     * @returns Array of selected nodes.
     */
    getSelectedNodes() {
        const { selectedIndices } = this.store;
        if (!selectedIndices)
            return null;
        const points = new Array(selectedIndices.length);
        for (const [i, selectedIndex] of selectedIndices.entries()) {
            if (selectedIndex !== undefined) {
                const index = this.graph.getInputIndexBySortedIndex(selectedIndex);
                if (index !== undefined)
                    points[i] = this.graph.nodes[index];
            }
        }
        return points;
    }
    /**
     * Get nodes that are adjacent to a specific node by its id.
     * @param id Id of the node.
     * @returns Array of adjacent nodes.
     */
    getAdjacentNodes(id) {
        return this.graph.getAdjacentNodes(id);
    }
    /**
     * Converts the X and Y node coordinates from the space coordinate system to the screen coordinate system.
     * @param spacePosition Array of x and y coordinates in the space coordinate system.
     * @returns Array of x and y coordinates in the screen coordinate system.
     */
    spaceToScreenPosition(spacePosition) {
        return this.zoomInstance.convertSpaceToScreenPosition(spacePosition);
    }
    /**
     * Converts the node radius value from the space coordinate system to the screen coordinate system.
     * @param spaceRadius Radius of Node in the space coordinate system.
     * @returns Radius of Node in the screen coordinate system.
     */
    spaceToScreenRadius(spaceRadius) {
        return this.zoomInstance.convertSpaceToScreenRadius(spaceRadius);
    }
    /**
     * Get node radius by its index.
     * @param index Index of the node.
     * @returns Radius of the node.
     */
    getNodeRadiusByIndex(index) {
        const node = this.graph.getNodeByIndex(index);
        return node && this.points.getNodeRadius(node);
    }
    /**
     * Get node radius by its id.
     * @param id Id of the node.
     * @returns Radius of the node.
     */
    getNodeRadiusById(id) {
        const node = this.graph.getNodeById(id);
        return node && this.points.getNodeRadius(node);
    }
    /**
     * Track multiple node positions by their ids on each Cosmos tick.
     * @param ids Array of nodes ids.
     */
    trackNodePositionsByIds(ids) {
        this.points.trackNodesByIds(ids);
    }
    /**
     * Track multiple node positions by their indices on each Cosmos tick.
     * @param ids Array of nodes indices.
     */
    trackNodePositionsByIndices(indices) {
        this.points.trackNodesByIds(indices.map(index => this.graph.getNodeByIndex(index))
            .filter((d) => d !== undefined)
            .map(d => d.id));
    }
    /**
     * Get current X and Y coordinates of the tracked nodes.
     * @returns A Map object where keys are the ids of the nodes and values are their corresponding X and Y coordinates in the [number, number] format.
     */
    getTrackedNodePositionsMap() {
        return this.points.getTrackedPositions();
    }
    /**
     * Start the simulation.
     * @param alpha Value from 0 to 1. The higher the value, the more initial energy the simulation will get.
     */
    start(alpha = 1) {
        var _a, _b;
        if (!this.graph.nodes.length)
            return;
        this.store.isSimulationRunning = true;
        this.store.alpha = alpha;
        this.store.simulationProgress = 0;
        (_b = (_a = this.config.simulation).onStart) === null || _b === void 0 ? void 0 : _b.call(_a);
        this.stopFrames();
        this.frame();
    }
    /**
     * Pause the simulation.
     */
    pause() {
        var _a, _b;
        this.store.isSimulationRunning = false;
        (_b = (_a = this.config.simulation).onPause) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Restart the simulation.
     */
    restart() {
        var _a, _b;
        this.store.isSimulationRunning = true;
        (_b = (_a = this.config.simulation).onRestart) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    /**
     * Render only one frame of the simulation (stops the simulation if it was running).
     */
    step() {
        this.store.isSimulationRunning = false;
        this.stopFrames();
        this.frame();
    }
    /**
     * Destroy this Cosmos instance.
     */
    destroy() {
        var _a;
        this.stopFrames();
        if (this.hasBeenRecentlyDestroyed)
            return;
        this.points.destroy();
        this.lines.destroy();
        this.forceCenter.destroy();
        this.forceLinkIncoming.destroy();
        this.forceLinkOutgoing.destroy();
        (_a = this.forceManyBody) === null || _a === void 0 ? void 0 : _a.destroy();
        this.reglInstance.destroy();
        this.hasBeenRecentlyDestroyed = true;
    }
    /**
     * Create new Cosmos instance.
     */
    create() {
        var _a;
        this.points.create();
        this.lines.create();
        (_a = this.forceManyBody) === null || _a === void 0 ? void 0 : _a.create();
        this.forceLinkIncoming.create(LinkDirection.INCOMING);
        this.forceLinkOutgoing.create(LinkDirection.OUTGOING);
        this.forceCenter.create();
        this.hasBeenRecentlyDestroyed = false;
    }
    update(runSimulation) {
        const { graph } = this;
        this.store.pointsTextureSize = Math.ceil(Math.sqrt(graph.nodes.length));
        this.store.linksTextureSize = Math.ceil(Math.sqrt(graph.linksNumber * 2));
        this.destroy();
        this.create();
        this.initPrograms();
        if (runSimulation) {
            this.start();
        }
        else {
            this.step();
        }
    }
    initPrograms() {
        var _a;
        this.points.initPrograms();
        this.lines.initPrograms();
        this.forceGravity.initPrograms();
        this.forceLinkIncoming.initPrograms();
        this.forceLinkOutgoing.initPrograms();
        this.forceMouse.initPrograms();
        (_a = this.forceManyBody) === null || _a === void 0 ? void 0 : _a.initPrograms();
        this.forceCenter.initPrograms();
    }
    frame() {
        const { config: { simulation, renderLinks }, store: { alpha, isSimulationRunning } } = this;
        if (alpha < ALPHA_MIN && isSimulationRunning)
            this.end();
        this.requestAnimationFrameId = window.requestAnimationFrame((now) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            (_a = this.fpsMonitor) === null || _a === void 0 ? void 0 : _a.begin();
            this.resizeCanvas();
            this.findHoveredPoint();
            if (this.isRightClickMouse) {
                if (!isSimulationRunning)
                    this.start(0.1);
                this.forceMouse.run();
                this.points.updatePosition();
            }
            if ((isSimulationRunning && !this.zoomInstance.isRunning)) {
                if (simulation.gravity) {
                    this.forceGravity.run();
                    this.points.updatePosition();
                }
                if (simulation.center) {
                    this.forceCenter.run();
                    this.points.updatePosition();
                }
                (_b = this.forceManyBody) === null || _b === void 0 ? void 0 : _b.run();
                this.points.updatePosition();
                this.forceLinkIncoming.run();
                this.points.updatePosition();
                this.forceLinkOutgoing.run();
                this.points.updatePosition();
                this.store.alpha += this.store.addAlpha((_c = this.config.simulation.decay) !== null && _c !== void 0 ? _c : defaultConfigValues.simulation.decay);
                if (this.isRightClickMouse)
                    this.store.alpha = Math.max(this.store.alpha, 0.1);
                this.store.simulationProgress = Math.sqrt(Math.min(1, ALPHA_MIN / this.store.alpha));
                (_e = (_d = this.config.simulation).onTick) === null || _e === void 0 ? void 0 : _e.call(_d, this.store.alpha, (_f = this.store.hoveredNode) === null || _f === void 0 ? void 0 : _f.node, this.store.hoveredNode ? this.graph.getInputIndexBySortedIndex(this.store.hoveredNode.index) : undefined, (_g = this.store.hoveredNode) === null || _g === void 0 ? void 0 : _g.position);
            }
            this.points.trackPoints();
            // Clear canvas
            this.reglInstance.clear({
                color: this.store.backgroundColor,
                depth: 1,
                stencil: 0,
            });
            if (renderLinks) {
                this.lines.draw();
            }
            this.points.draw();
            (_h = this.fpsMonitor) === null || _h === void 0 ? void 0 : _h.end(now);
            this.currentEvent = undefined;
            this.frame();
        });
    }
    stopFrames() {
        if (this.requestAnimationFrameId)
            window.cancelAnimationFrame(this.requestAnimationFrameId);
    }
    end() {
        var _a, _b;
        this.store.isSimulationRunning = false;
        this.store.simulationProgress = 1;
        (_b = (_a = this.config.simulation).onEnd) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    onClick(event) {
        var _a, _b, _c, _d;
        this.store.setFocusedNode((_a = this.store.hoveredNode) === null || _a === void 0 ? void 0 : _a.node, (_b = this.store.hoveredNode) === null || _b === void 0 ? void 0 : _b.index);
        (_d = (_c = this.config.events).onClick) === null || _d === void 0 ? void 0 : _d.call(_c, { event, node: this.store.hoveredNode, graph: this });
    }
    updateMousePosition(event) {
        if (!event || event.offsetX === undefined || event.offsetY === undefined)
            return;
        const { x, y, k } = this.zoomInstance.eventTransform;
        const h = this.canvas.clientHeight;
        const mouseX = event.offsetX;
        const mouseY = event.offsetY;
        const invertedX = (mouseX - x) / k;
        const invertedY = (mouseY - y) / k;
        this.store.mousePosition = [invertedX, (h - invertedY)];
        this.store.mousePosition[0] -= (this.store.screenSize[0] - this.config.spaceSize) / 2;
        this.store.mousePosition[1] -= (this.store.screenSize[1] - this.config.spaceSize) / 2;
        this.store.screenMousePosition = [mouseX, (this.store.screenSize[1] - mouseY)];
    }
    onMouseMove(event) {
        var _a, _b, _c, _d;
        this.currentEvent = event;
        this.updateMousePosition(event);
        this.isRightClickMouse = event.which === 3;
        (_b = (_a = this.config.events).onMouseMove) === null || _b === void 0 ? void 0 : _b.call(_a, (_c = this.store.hoveredNode) === null || _c === void 0 ? void 0 : _c.node, this.store.hoveredNode ? this.graph.getInputIndexBySortedIndex(this.store.hoveredNode.index) : undefined, (_d = this.store.hoveredNode) === null || _d === void 0 ? void 0 : _d.position, this.currentEvent);
    }
    onRightClickMouse(event) {
        event.preventDefault();
    }
    resizeCanvas() {
        const prevWidth = this.canvas.width;
        const prevHeight = this.canvas.height;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        if (prevWidth !== w * this.config.pixelRatio || prevHeight !== h * this.config.pixelRatio) {
            this.store.updateScreenSize(w, h, this.config.spaceSize);
            this.canvas.width = w * this.config.pixelRatio;
            this.canvas.height = h * this.config.pixelRatio;
            this.reglInstance.poll();
            this.canvasD3Selection
                .call(this.zoomInstance.behavior.transform, this.zoomInstance.eventTransform);
        }
    }
    setZoomTransformByNodePositions(positions, duration = 250, scale) {
        const transform = this.zoomInstance.getTransform(positions, scale);
        this.canvasD3Selection
            .transition()
            .ease(easeQuadInOut)
            .duration(duration)
            .call(this.zoomInstance.behavior.transform, transform);
    }
    zoomToNode(node, duration, scale, canZoomOut) {
        const { graph, store: { screenSize } } = this;
        const positionPixels = readPixels(this.reglInstance, this.points.currentPositionFbo);
        const nodeIndex = graph.getSortedIndexById(node.id);
        if (nodeIndex === undefined)
            return;
        const posX = positionPixels[nodeIndex * 4 + 0];
        const posY = positionPixels[nodeIndex * 4 + 1];
        if (posX === undefined || posY === undefined)
            return;
        const distance = this.zoomInstance.getDistanceToPoint([posX, posY]);
        const zoomLevel = canZoomOut ? scale : Math.max(this.getZoomLevel(), scale);
        if (distance < Math.min(screenSize[0], screenSize[1])) {
            this.setZoomTransformByNodePositions([[posX, posY]], duration, zoomLevel);
        }
        else {
            const transform = this.zoomInstance.getTransform([[posX, posY]], zoomLevel);
            const middle = this.zoomInstance.getMiddlePointTransform([posX, posY]);
            this.canvasD3Selection
                .transition()
                .ease(easeQuadIn)
                .duration(duration / 2)
                .call(this.zoomInstance.behavior.transform, middle)
                .transition()
                .ease(easeQuadOut)
                .duration(duration / 2)
                .call(this.zoomInstance.behavior.transform, transform);
        }
    }
    findHoveredPoint() {
        var _a, _b, _c, _d, _e;
        this.points.findHoveredPoint();
        let isMouseover = false;
        let isMouseout = false;
        const pixels = readPixels(this.reglInstance, this.points.hoveredFbo);
        const nodeSize = pixels[1];
        if (nodeSize) {
            const index = pixels[0];
            const inputIndex = this.graph.getInputIndexBySortedIndex(index);
            const hovered = inputIndex !== undefined ? this.graph.getNodeByIndex(inputIndex) : undefined;
            if (((_a = this.store.hoveredNode) === null || _a === void 0 ? void 0 : _a.node) !== hovered)
                isMouseover = true;
            const pointX = pixels[2];
            const pointY = pixels[3];
            this.store.hoveredNode = hovered && {
                node: hovered,
                index,
                position: [pointX, pointY],
            };
        }
        else {
            if (this.store.hoveredNode)
                isMouseout = true;
            this.store.hoveredNode = undefined;
        }
        if (isMouseover && this.store.hoveredNode) {
            (_c = (_b = this.config.events).onNodeMouseOver) === null || _c === void 0 ? void 0 : _c.call(_b, this.store.hoveredNode.node, this.graph.getInputIndexBySortedIndex(this.graph.getSortedIndexById(this.store.hoveredNode.node.id)), this.store.hoveredNode.position, this.currentEvent);
        }
        if (isMouseout)
            (_e = (_d = this.config.events).onNodeMouseOut) === null || _e === void 0 ? void 0 : _e.call(_d, this.currentEvent);
    }
}

export { Graph };
//# sourceMappingURL=index.js.map
