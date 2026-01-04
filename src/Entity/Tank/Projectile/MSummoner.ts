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

import Barrel from "../Barrel";
import Drone from "./Drone";

import { InputFlags, PhysicsFlags, Color } from "../../../Const/Enums";
import { BarrelDefinition, TankDefinition } from "../../../Const/TankDefinitions";
import { AIState, Inputs } from "../../AI";
import { BarrelBase } from "../TankBody";
import { CameraEntity } from "../../../Native/Camera";

/**
 * Barrel definition for the summoner minion's barrel.
 */
 const MinionBarrelDefinition: BarrelDefinition = {
    angle: 0,
    offset: 0,
    size: 75,
    width: 42,
    delay: 0,
    reload: 0.5,
    recoil: 1,
    isTrapezoid: true,
    trapezoidDirection: 0,
    addon: null,
    droneCount: 4,
    canControlDrones: true,
    bullet: {
        type: "drone",
        sizeRatio: 0.8,
        health: 2.5,
        damage: 0.7,
        speed: 1.7,
        scatterRate: 1,
        lifeLength: -1,
        absorbtionFactor: 1,
        sides: 4
    }
};

/**
 * The drone class represents the minion (projectile) entity in diep.
 */
export default class MSummoner extends Drone implements BarrelBase {
    /** Size of the focus the minions orbit. */
    public static FOCUS_RADIUS = 850 ** 2;

    /** The minion's barrels for spawning squares */
    private spawners: Barrel[] = [];

    /** The camera entity (used as team) of the minion. */
    public cameraEntity: CameraEntity;
    /** The reload time of the minion's barrels. */
    public reloadTime = 1;
    /** The inputs for when to shoot or not. */
    public inputs = new Inputs();
    /** The rotation speed of the minion. */
    private rotationRate = 0.5;

    public constructor(barrel: Barrel, tank: BarrelBase, tankDefinition: TankDefinition | null, shootAngle: number) {
        super(barrel, tank, tankDefinition, shootAngle);

        const bulletDefinition = barrel.definition.bullet;

        this.inputs = this.ai.inputs;
        this.ai.viewRange = 900;
        this.usePosAngle = false;

        this.physicsData.values.sides = 4; // Always square
        this.physicsData.values.size *= 1.5; // Bigger than normal minion
        
        if (this.physicsData.values.flags & PhysicsFlags.noOwnTeamCollision) this.physicsData.values.flags ^= PhysicsFlags.noOwnTeamCollision;
        if (this.physicsData.values.flags & PhysicsFlags.canEscapeArena) this.physicsData.values.flags ^= PhysicsFlags.canEscapeArena;

        this.physicsData.values.flags |= PhysicsFlags.onlySameOwnerCollision;

        this.cameraEntity = tank.cameraEntity;

        // Create 4 spawners at 90 degree angles
        for (let i = 0; i < 4; ++i) {
            this.spawners.push(new Barrel(this, {
                ...MinionBarrelDefinition,
                angle: (Math.PI / 2) * i
            }));
        }

        this.ai.movementSpeed = this.ai.aimSpeed = this.baseAccel;
    }

    public get sizeFactor() {
        return this.physicsData.values.size / 50;
    }

    /** This allows for factory to hook in before the entity moves. */
    protected tickMixin(tick: number) {
        this.reloadTime = this.tank.reloadTime;

        const usingAI = !this.canControlDrones || !this.tank.inputs.attemptingShot() && !this.tank.inputs.attemptingRepel();
        const inputs = !usingAI ? this.tank.inputs : this.ai.inputs;

        if (usingAI && this.ai.state === AIState.idle) {
            this.movementAngle = this.positionData.values.angle;
        } else {
            this.inputs.flags |= InputFlags.leftclick;

            const dist = inputs.mouse.distanceToSQ(this.positionData.values);

            if (dist < MSummoner.FOCUS_RADIUS / 4) { // Half
                this.movementAngle = this.positionData.values.angle + Math.PI;
            } else if (dist < MSummoner.FOCUS_RADIUS) {
                this.movementAngle = this.positionData.values.angle + Math.PI / 2;
            } else this.movementAngle = this.positionData.values.angle;
        }

        // Add passive rotation like the Summoner boss
        this.positionData.angle += this.rotationRate * 0.05;

        super.tickMixin(tick);
    }
}
