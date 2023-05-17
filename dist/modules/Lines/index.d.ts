import { CoreModule } from "../core-module";
import { CosmosInputNode, CosmosInputLink } from "../../types";
export declare class Lines<N extends CosmosInputNode, L extends CosmosInputLink> extends CoreModule<N, L> {
    private drawStraightCommand;
    private colorBuffer;
    private widthBuffer;
    create(): void;
    initPrograms(): void;
    draw(): void;
    updateColor(): void;
    updateWidth(): void;
    destroy(): void;
}
