import ArenaEntity from "../Native/Arena";
import { ArenaState } from "../Native/Arena";
import GameServer from "../Game";

import AbstractBot from "./AbstractBot";
import { removeFast } from "../util";
import Bot from "./Misc/Bot";

/**
 * Used to balance out bot count in the arena, as well
 */

export default class BotManager {
    /** Current game server */
    protected game: GameServer;
    /** Arena whose shapes are being managed */
    protected arena: ArenaEntity;
    /** Stores all bots */
    protected bots: AbstractBot[] = [];

    public constructor(arena: ArenaEntity) {
        this.arena = arena;
        this.game = arena.game;
    }

    /**
     * Spawns a bot in a random location on the map.
     */
    protected spawnbot(): AbstractBot {
        let bot: AbstractBot;
        const {x, y} = this.arena.findSpawnLocation();
        
        // Fields of Shapes
        bot = new Bot(this.game);

        // Only set position if not already set by bot constructor
        if (bot.positionData.values.x === 0 && bot.positionData.values.y === 0) {
            bot.positionData.values.x = x;
            bot.positionData.values.y = y;
        }

        bot.scoreReward *= this.arena.shapeScoreRewardMultiplier;

        return bot;
    }

    /** Kills all bots in the arena */
    public killAll() {
        for(let i = 0; i < this.bots.length; ++i) {
            this.bots[i]?.delete();
        }
    }

    protected get wantedBots() {
        if (this.arena.state === ArenaState.OPEN) {
            // 40 bots max in open state
            return 40;
        } else {
            // No bots if not open
            return 0;
        }
    }

    public tick() {
        for (let i = this.wantedBots; i --> 0;) {
            const bot = this.bots[i];
            // Alternatively, Entity.exists(bot), though this is probably faster
            if (!bot || bot.hash === 0) this.bots[i] = this.spawnbot();
        }
    }
}
