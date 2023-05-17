import { CosmosInputNode, CosmosInputLink } from "../../types";
export declare class GraphData<N extends CosmosInputNode, L extends CosmosInputLink> {
    /** Links that have existing source and target nodes  */
    completeLinks: Set<L>;
    degree: number[];
    /** Mapping the source node index to a `Set` of target node indices connected to that node */
    groupedSourceToTargetLinks: Map<number, Set<number>>;
    /** Mapping the target node index to a `Set` of source node indices connected to that node */
    groupedTargetToSourceLinks: Map<number, Set<number>>;
    private _nodes;
    private _links;
    /** Mapping the original id to the original node */
    private idToNodeMap;
    /** We want to display more important nodes (i.e. with the biggest number of connections)
     * on top of the other. To render them in the right order,
     * we create an array of node indices sorted by degree (number of connections)
     * and and we store multiple maps that help us referencing the right data objects
     * and other properties by original node index, sorted index, and id 👇. */
    /** Mapping the sorted index to the original index */
    private sortedIndexToInputIndexMap;
    /** Mapping the original index to the sorted index of the node */
    private inputIndexToSortedIndexMap;
    /** Mapping the original id to the sorted index of the node */
    private idToSortedIndexMap;
    /** Mapping the original index to the original id of the node */
    private inputIndexToIdMap;
    /** Mapping the original id to the indegree value of the node */
    private idToIndegreeMap;
    /** Mapping the original id to the outdegree value of the node */
    private idToOutdegreeMap;
    get nodes(): N[];
    get links(): L[];
    get linksNumber(): number;
    setData(inputNodes: N[], inputLinks: L[]): void;
    getNodeById(id: string): N | undefined;
    getNodeByIndex(index: number): N | undefined;
    getSortedIndexByInputIndex(index: number): number | undefined;
    getInputIndexBySortedIndex(index: number): number | undefined;
    getSortedIndexById(id: string | undefined): number | undefined;
    getAdjacentNodes(id: string): N[] | undefined;
}
