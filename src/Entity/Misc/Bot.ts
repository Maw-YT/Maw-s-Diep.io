import GameServer from "../../Game";
import Barrel from "../Tank/Barrel";
import TankDefinitions, { getTankById } from "../../Const/TankDefinitions";
import AbstractBot from "../AbstractBot";
import LivingEntity from "../Live";
import { Color } from "../../Const/Enums";

import { AIState } from "../AI";
import DevTankDefinitions from "../../Const/DevTankDefinitions";
import { saveToLog, saveToVLog } from "../../util";

function getRandomNumber(minNumb: number, maxNumb: number): number {
    // Math.random() generates a float between 0 (inclusive) and 1 (exclusive)
    const min = minNumb;
    const max = maxNumb;
    
    // Calculate the range size (max - min + 1)
    const range = max - min + 1; 

    // Generate random number within the range, including negative values
    const randomNumber = Math.floor(Math.random() * range) + min;

    return randomNumber;
}

let DevModeEnabled = false; // Set to true to enable dev mode
let DevTanks = false; // Set to true to use dev tanks

/**
 * Class which represents a funny Player AI Bot.
 */
export default class Bot extends AbstractBot {
	// simplified boredom state
	protected targetDuration: number = 0;
	protected maxTargetDuration: number = 300; // ticks before getting bored of current target
	
	// not target list system
	protected notTargetList: Array<any> = [];
	protected maxNotTargets: number = 5;
	
	// retaliation system
	protected lastAttacker: any = null;
	protected retaliationTimer: number = 0;
	protected retaliationDuration: number = 300; // ticks to retaliate before returning to normal behavior
	
	// strafing system
	protected strafeDirection: number = Math.random() > 0.5 ? 1 : -1; // Random starting direction
	protected strafeTimer: number = 0;
	protected strafeInterval: number = 60; // ticks between strafe direction changes

    // Exclude tank defs list
    protected excludedTankDefs: number[] = [16,
        17,
        36,
        38,
        40,
        41,
        45,
        46,
        47,
        50,
        51,
        53,
        -12,
        27
    ]
    protected tankId: any = null;

    public constructor(game: GameServer) {
        super(game);

        // --- Team 2 support ---
        // Move Teams2Arena import here to avoid circular dependency issues
        let Teams2Arena: any;
        try {
            Teams2Arena = require("../../Gamemodes/Team2").default;
        } catch {}
        let MothershipArena: any;
        try {
            MothershipArena = require("../../Gamemodes/Mothership").default;
        } catch {}
        const arena = this.game.arena;
        // Type guard: check for blueTeamBase/redTeamBase properties
        const isTeams2Arena = (a: any): a is { blueTeamBase: any, redTeamBase: any } =>
            a && typeof a.blueTeamBase === "object" && typeof a.redTeamBase === "object";
        // Add a type guard for MothershipArena
        const isMothershipArena = (a: any): a is { motherships: any[] } =>
            a && Array.isArray(a.motherships);

        if (Teams2Arena && isTeams2Arena(arena)) {
            // Randomly pick a team base
            const bases = [arena.blueTeamBase, arena.redTeamBase];
            const base = bases[Math.floor(Math.random() * bases.length)];
            this.relationsData.values.team = base.relationsData.values.team;
            this.styleData.values.color = base.styleData.values.color;
            // Optionally spawn near base
            this.positionData.values.x = base.positionData.values.x + (Math.random() - 0.5) * 200;
            this.positionData.values.y = base.positionData.values.y + (Math.random() - 0.5) * 200;
        } else
        // --- Mothership gamemode support ---
        if (MothershipArena && isMothershipArena(arena)) {
            // Pick a random mothership and its team
            const motherships = arena.motherships;
            if (motherships && motherships.length > 0) {
                const myMothership = motherships[Math.floor(Math.random() * motherships.length)];
                this.relationsData.values.team = myMothership.relationsData.values.team;
                this.styleData.values.color = myMothership.styleData.values.color;
                // Spawn exactly at mothership position (no offset)
                this.positionData.values.x = myMothership.positionData.values.x;
                this.positionData.values.y = myMothership.positionData.values.y;
                // Store reference for later use
                (this as any)._myMothership = myMothership;
            }
        } else {
            this.styleData.values.color = Color.EnemyTank;
        }

        this.movementSpeed = 3
        this.healthData.values.health = this.healthData.values.maxHealth = 50 + (this.level * 3); // health scales with level
        this.physicsData.values.size = 50 + this.level; // size scales with level

        const tankDef = DevTanks ? DevTankDefinitions[-getRandomNumber(0, DevTankDefinitions.length - 1)] : TankDefinitions[getRandomNumber(0, TankDefinitions.length - 1)];
        // Excluded tank definition check
        if (tankDef && this.excludedTankDefs.includes(tankDef.id) || !tankDef) {
            this.destroy(false); // no animation
            return;
        } else {
            if (tankDef) {
                this.tankId = tankDef.id;
                this.nameData.values.name = DevModeEnabled ? 'Bot ' + '(Lv. ' + this.level + ', Id: ' + this.tankId + ')' : 'Bot';
            }
        }

        // Barrel existence check
        if (tankDef && !tankDef.barrels || tankDef && tankDef.barrels.length === 0) {
            this.destroy(false); // no animation
            return;
        }

        // Level requirement check
        if (tankDef && tankDef.levelRequirement > this.level && DevTanks === false) {
            this.destroy(false); // no animation
            return;
        }

        // Apply tank definition barrels
        if (tankDef && tankDef.barrels) {
            for (const barrelDefinition of tankDef.barrels) {
                this.barrels.push(new Barrel(this, barrelDefinition));
            }
        }

        // Apply tank definition sides and validate barrels again..
        if (tankDef) {
            this.physicsData.values.sides = tankDef.sides;
            if (tankDef.barrels.length === 0 || !tankDef.barrels) {
                this.destroy(false); // no animation
                return;
            }
        }
    }

    public get sizeFactor() {
        return this.physicsData.values.size / 50;
    }

	// Add method to track damage sources
	public onDamage(damage: number, source: LivingEntity) {
		// --- Team 2 support: Don't retaliate against teammates ---
		if (
			source && source !== this &&
			(!source.relationsData || !this.relationsData.values.team || source.relationsData.values.team !== this.relationsData.values.team)
		) {
			this.lastAttacker = source;
			this.retaliationTimer = this.retaliationDuration;
			this.targetDuration = 0; // Reset boredom timer when retaliating
			
			// Set attacker as target
			if (source.positionData && source.positionData.values) {
				this.ai.target = source;
				this.ai.inputs.mouse.x = source.positionData.values.x;
				this.ai.inputs.mouse.y = source.positionData.values.y;
			}
		}
	}

    protected moveAroundMap() {
        if (this.ai.state === AIState.idle) {
            // Roaming: use base roaming logic if idle (no target)
            super.moveAroundMap();
            this.positionData.angle += this.ai.passiveRotation;
            this.accel.set({x: 0, y: 0});
            
            // Update strafing behavior even when idle
            this.strafeTimer++;
            if (this.strafeTimer >= this.strafeInterval) {
                this.strafeTimer = 0;
                this.strafeDirection *= -1; // Switch direction
            }
        } else {
            const x = this.positionData.values.x,
                  y = this.positionData.values.y;

            // --- Mothership gamemode: ignore own mothership as target ---
            let myMothership = (this as any)._myMothership;
            let currentTarget = this.ai.target;
            let targetX = this.ai.inputs.mouse.x;
            let targetY = this.ai.inputs.mouse.y;

            // Roaming: if no target, use base roaming logic
            if (!currentTarget) {
                super.moveAroundMap();
                return;
            }

            // Ignore own mothership as target
            if (myMothership && currentTarget === myMothership) {
                this.ai.target = null;
                this.targetDuration = 0;
                // Move away from mothership
                const deltaX = targetX - x;
                const deltaY = targetY - y;
                const angle = Math.atan2(deltaY, deltaX);
                this.inputs.movement.x = -Math.cos(angle);
                this.inputs.movement.y = -Math.sin(angle);
                return;
            }

			// Handle retaliation priority
			if (this.retaliationTimer > 0 && this.lastAttacker) {
				this.retaliationTimer--;
                if (this.lastAttacker.healthData.values.health <= 0) {
                    this.retaliationTimer = 0;
                }
				currentTarget = this.lastAttacker;
				
				// Update target to current attacker position
				if (this.lastAttacker.positionData && this.lastAttacker.positionData.values) {
					targetX = this.lastAttacker.positionData.values.x;
					targetY = this.lastAttacker.positionData.values.y;
					this.ai.target = this.lastAttacker;
					this.ai.inputs.mouse.x = targetX;
					this.ai.inputs.mouse.y = targetY;
				}
			} else {
				// Normal behavior when not retaliating
				this.lastAttacker = null;
				
				// Increment target duration timer only when not retaliating
				this.targetDuration++;

				// --- Team 2 and Mothership: Don't target teammates ---
				if (
					currentTarget &&
					currentTarget.relationsData &&
					this.relationsData.values.team &&
					currentTarget.relationsData.values.team === this.relationsData.values.team
				) {
					this.ai.target = null;
					this.targetDuration = 0;
					// Move away from the teammate
					const deltaX = targetX - x;
					const deltaY = targetY - y;
					const angle = Math.atan2(deltaY, deltaX);
					this.inputs.movement.x = -Math.cos(angle);
					this.inputs.movement.y = -Math.sin(angle);
					return;
				}

				// Check if current target is in not target list (only when not retaliating)
				if (currentTarget && this.notTargetList.includes(currentTarget)) {
					this.ai.target = null;
					this.targetDuration = 0;
					// Move away from the unwanted target
					const deltaX = targetX - x;
					const deltaY = targetY - y;
					const angle = Math.atan2(deltaY, deltaX);
					this.inputs.movement.x = -Math.cos(angle);
					this.inputs.movement.y = -Math.sin(angle);
					return; // Skip rest of movement logic
				}

				// If targeting same thing for too long, add to not target list and pick new target (only when not retaliating)
				if (this.targetDuration >= this.maxTargetDuration) {
					this.targetDuration = 0;
					
					// Add current target to not target list if it exists
					if (currentTarget) {
						// Remove oldest target if list is full
						if (this.notTargetList.length >= this.maxNotTargets) {
							this.notTargetList.shift();
						}
						this.notTargetList.push(currentTarget);
					}
					
					this.ai.target = null;
					const arena = this.game.arena.arenaData.values;
					targetX = Math.random() * (arena.rightX - arena.leftX) + arena.leftX;
					targetY = Math.random() * (arena.bottomY - arena.topY) + arena.topY;
					this.ai.inputs.mouse.x = targetX;
					this.ai.inputs.mouse.y = targetY;
				}
			}

            // Calculate distance to mouse target
            const deltaX = targetX - x;
            const deltaY = targetY - y;
            const dist = deltaX ** 2 + deltaY ** 2;
            
            const angle = Math.atan2(deltaY, deltaX);
            
            // Check if any other entities are too close
            let shouldChangeTarget = false;
            const entitiesIterable: any[] = (() => {
                const em: any = this.game.entities;
                if (em == null) return [];
                if (typeof em.values === 'function') {
                    return Array.from(em.values());
                }
                if (typeof em.getAll === 'function') {
                    return em.getAll();
                }
                if (Array.isArray(em.entities)) {
                    return em.entities;
                }
                if (Array.isArray(em)) {
                    return em;
                }
                try {
                    return Object.values(em);
                } catch {
                    return [];
                }
            })();

            for (const entity of entitiesIterable) {
                if (entity === this || !(entity instanceof AbstractBot)) continue;
                
                const entityDeltaX = entity.positionData.values.x - x;
                const entityDeltaY = entity.positionData.values.y - y;
                const entityDist = entityDeltaX ** 2 + entityDeltaY ** 2;
                
                // If another bot is too close (within 200 units), change target
                if (entityDist < 40000 /* 200 ** 2 */) {
                    shouldChangeTarget = true;
                    break;
                }
            }

            // Update strafing behavior
            this.strafeTimer++;
            if (this.strafeTimer >= this.strafeInterval) {
                this.strafeTimer = 0;
                this.strafeDirection *= -1; // Switch direction
            }

            // Calculate strafe angle (perpendicular to target direction)
            const strafeAngle = angle + (Math.PI / 2) * this.strafeDirection;
            
            // If too close (within 200 units), move back (away from target) with strafing
            if (dist < 40000 /* 200 ** 2 */) {
                const backAngle = angle + Math.PI; // Opposite direction
                this.inputs.movement.x = -Math.cos(backAngle) + Math.cos(strafeAngle) * 0.5;
                this.inputs.movement.y = -Math.sin(backAngle) + Math.sin(strafeAngle) * 0.5;
            } 
            // If too far (beyond 500 units), move forward (toward target) with strafing
            else if (dist > 250000 /* 500 ** 2 */ || shouldChangeTarget) {
                this.inputs.movement.x = Math.cos(angle) + Math.cos(strafeAngle) * 0.5;
                this.inputs.movement.y = Math.sin(angle) + Math.sin(strafeAngle) * 0.5;
            } 
            // If at good distance, strafe left and right
            else {
                this.inputs.movement.x = Math.cos(strafeAngle) * 0.7;
                this.inputs.movement.y = Math.sin(strafeAngle) * 0.7;
            }

            this.positionData.angle = angle;
        }
    }

    public tick(tick: number) {
        super.tick(tick);
        this.nameData.values.name = DevModeEnabled ? 'Bot ' + '(Lv. ' + this.level + ', TankId: ' + this.tankId + ', Id: ' + this + ')' : 'Bot';
        if (DevModeEnabled === true) {
            saveToVLog('Bot Id: ' + this + ', Target: ' + this.ai.target + ', Target healthdata: ' + this.ai.target?.healthData?.values.health);
        }
    }
}