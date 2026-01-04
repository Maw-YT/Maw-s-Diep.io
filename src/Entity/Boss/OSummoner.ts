/*
    DiepCustom - custom tank game server that shares diep.io's WebSocket protocol
    Copyright (C) 2022 ABCxFF (github.com/ABCxFF)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>
*/

import GameServer from "../../Game";
import Barrel from "../Tank/Barrel";
import AbstractBoss from "./AbstractBoss";

import { Color, Tank } from "../../Const/Enums";
import { AIState } from "../AI";

import { BarrelDefinition } from "../../Const/TankDefinitions";
import { PI2 } from "../../util";

const OmegaSummonerBarrelDefinition: BarrelDefinition = {
    angle: Math.PI,
    offset: 0,
    size: 175,
    width: 84,
    delay: 0,
    reload: 4,
    recoil: 1,
    isTrapezoid: true,
    trapezoidDirection: 0,
    addon: null,
    droneCount: 1,
    canControlDrones: true,
    bullet: {
        type: "msummoner",
        sizeRatio: 1,
        health: 20,
        damage: 4,
        speed: 0.7,
        scatterRate: 1,
        lifeLength: 10, // Time it take to despawn if not killed, 10 seconds should do.
        absorbtionFactor: 1,
        color: Color.EnemySquare,
        sides: 4
    }
};

const OMEGA_SUMMONER_SIZE = 200;
/**
 * Class which represents the boss "Omega Summoner", a larger variant that spawns Summoner minions
 */
export default class OSummoner extends AbstractBoss {

    /** Omega Summoner spawners */
    private spawners: Barrel[] = [];

    public constructor(game: GameServer) {
        super(game);

        this.nameData.values.name = 'Omega Summoner';
        this.styleData.values.color = Color.EnemySquare;
        this.relationsData.values.team = this.game.arena;
        this.physicsData.values.size = OMEGA_SUMMONER_SIZE * Math.SQRT1_2;
        this.physicsData.values.sides = 4;
        this.healthData.values.health = this.healthData.values.maxHealth = 4000;

        for (let i = 0; i < 4; ++i) {
            this.spawners.push(new Barrel(this, {
                ...OmegaSummonerBarrelDefinition,
                angle: PI2 * ((i / 4))
            }));
        }
    }

    public get sizeFactor() {
        return (this.physicsData.values.size / Math.SQRT1_2) / OMEGA_SUMMONER_SIZE;
    }

    public tick(tick: number) {
        super.tick(tick);

        if (this.ai.state !== AIState.possessed) {
            // Slower rotation than regular summoner due to larger size
            this.positionData.angle += this.ai.passiveRotation * 0.5;
        }
    }
}
