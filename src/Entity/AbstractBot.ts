import GameServer from "../Game";
import Barrel from "./Tank/Barrel";

import { ClientBound, Color, PositionFlags, NameFlags } from "../Const/Enums";
import { VectorAbstract } from "../Physics/Vector";
import { AI, AIState, Inputs } from "./AI";
import { NameGroup } from "../Native/FieldGroups";
import LivingEntity from "./Live";
import TankBody from "./Tank/TankBody";
import { CameraEntity } from "../Native/Camera";

function getRandomNumber(minNumb: number, maxNumb: number, bias = 1): number {
    // When bias > 1, smaller numbers become more common. bias == 1 -> uniform.
    const min = minNumb;
    const max = maxNumb;
    const range = max - min + 1;

    // Use a biased random in [0,1): Math.pow(rand, bias) skews toward 0 when bias>1.
    const biased = Math.pow(Math.random(), bias);
    const randomNumber = Math.floor(biased * range) + min;

    return randomNumber;
}

/**
 * Possible targets for movement
 */
enum Target {
    None = -1,
    BottomRight = 0,
    TopRight = 1,
    TopLeft = 2,
    BottomLeft = 3,
    Center = 4
}

class BotMovementControl {
    /** Current target on the map. */
    public target: Target = Target.None;

    /** The bot thats movement is being controlled. */
    public bot: AbstractBot;

    public constructor(bot: AbstractBot) {
        this.bot = bot;
    }
    
    public moveBoss() {
        const { x, y } = this.bot.positionData.values;
        if (this.target === Target.None) {
            if (x >= 0 && y >= 0) {
                this.target = Target.BottomRight;
            } else if (x <= 0 && y >= 0) {
                this.target = Target.BottomLeft;
            } else if (x <= 0 && y <= 0) {
                this.target = Target.TopLeft;
            }else /*if (x >= 0 && y <= 0)*/ {
                this.target = Target.TopRight;
            }
        }

        let target: VectorAbstract;
        switch (this.target) {
            case Target.BottomRight:
                target = {
                    x: 3 * this.bot.game.arena.arenaData.values.rightX / 4,
                    y: 3 * this.bot.game.arena.arenaData.values.bottomY / 4
                };
                break;
            case Target.BottomLeft:
                target = {
                    x: 3 * this.bot.game.arena.arenaData.values.leftX / 4,
                    y: 3 * this.bot.game.arena.arenaData.values.bottomY / 4
                };
                break;
            case Target.TopLeft:
                target = {
                    x: 3 * this.bot.game.arena.arenaData.values.leftX / 4,
                    y: 3 * this.bot.game.arena.arenaData.values.topY / 4
                };
                break;
            case Target.TopRight:
                target = {
                    x: 3 * this.bot.game.arena.arenaData.values.rightX / 4,
                    y: 3 * this.bot.game.arena.arenaData.values.topY / 4
                };
                break;
            case Target.Center:
                target = {
                    x: (this.bot.game.arena.arenaData.values.leftX + this.bot.game.arena.arenaData.values.rightX) / 2,
                    y: (this.bot.game.arena.arenaData.values.topY + this.bot.game.arena.arenaData.values.bottomY) / 2
                };
                break;
            default:
                target = { x: 0, y: 0 };
        }

        // Target becomes delta now
        target.x = (target.x - x);
        target.y = (target.y - y);
        const dist = target.x ** 2 + target.y ** 2;
        
        const angle = Math.atan2(target.y, target.x);
        
        if (dist > 90000 /* 300 ** 2 */) {
            this.bot.inputs.movement.x = Math.cos(angle);
            this.bot.inputs.movement.y = Math.sin(angle);
        } 
        // If at good distance, change target
        else {
            // Cycle through all 5 targets (including center)
            this.target = (this.target + 1) % 5;
        }
    }
}

/**
 * Class which represents all the bots.
 */
export default class AbstractBot extends LivingEntity {
    /** Always existant name field group, present in all bosses. */
    public nameData: NameGroup = new NameGroup(this);
    /** Alternate name, eg Guardian and Guardian of the Pentagons to appear in notifications" */
    public altName: string | null = null;
    /** The reload time calculation property. Used for calculating reload of barrels. */
    public reloadTime = 15;
    /** level of bot */
    public level = getRandomNumber(1, 90, 20);

    /** The AI that controls how this boss moves. */
    public ai: AI;
    /** The AI's inputs (for fullfilling BarrelBase typedef). */
    public inputs: Inputs;

    /** The bot's "camera entity" */
    public cameraEntity: CameraEntity = this as unknown as CameraEntity;

    /** List of the boss barrels. */
    protected barrels: Barrel[] = [];
    /** The speed to maintain during movement. */
    public movementSpeed = 0.25;

    /** The thing that controls map wide movement. */
    protected movementControl = new BotMovementControl(this)

    public constructor(game: GameServer) {
        super(game);

        const {x, y} = this.game.arena.findSpawnLocation();
        this.positionData.values.x = x;
        this.positionData.values.y = y;
        
        this.relationsData.values.team = this.cameraEntity;

        this.physicsData.values.absorbtionFactor = 0.05;
        this.positionData.values.flags |= PositionFlags.absoluteRotation;
        this.scoreReward = (100 * this.level) * this.game.arena.shapeScoreRewardMultiplier;
        this.damagePerTick = 10 + (this.level * 0.25);

        //this.nameData.flags |= NameFlags.hiddenName; // hide name by default

        this.ai = new AI(this);
        this.ai.viewRange = 2000;
        this.ai['_findTargetInterval'] = 0;
        this.inputs = this.ai.inputs;

        // default ehColor
        this.styleData.values.color = Color.Fallen;

        this.physicsData.values.sides = 1;
        this.physicsData.values.size = 50 * Math.pow(1.01, 75 - 1);

        this.reloadTime = 15 * Math.pow(0.914, 7);

        this.healthData.values.health = this.healthData.values.maxHealth = 3000;
    }

    public get sizeFactor() {
        return this.physicsData.values.size / 50;
    }

    // For map wide movement
    protected moveAroundMap() {
        this.movementControl.moveBoss();
    }

    public tick(tick: number) {
        if (this.inputs !== this.ai.inputs) this.inputs = this.ai.inputs;

        this.ai.movementSpeed = this.movementSpeed;
        
        if (this.ai.state !== AIState.possessed) this.moveAroundMap();
        else {
            const x = this.positionData.values.x,
                  y = this.positionData.values.y;

            this.positionData.angle = Math.atan2(this.ai.inputs.mouse.y - y, this.ai.inputs.mouse.x - x);
        }
        this.accel.add({
            x: this.inputs.movement.x * this.movementSpeed,
            y: this.inputs.movement.y * this.movementSpeed,
        });
        this.inputs.movement.set({
            x: 0,
            y: 0
        });

        this.regenPerTick = this.healthData.values.maxHealth / 25000;

        super.tick(tick);
    }
}
