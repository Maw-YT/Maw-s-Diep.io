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

/**
 * UNDOCUMENTED FILE
 **/

import ObjectEntity from "../Entity/Object";
import CollisionManager from "./CollisionManager";

interface Range<T> {
    x: number;
    y: number;
    radiW: number;
    radiH: number;
    content: T;
}

class QuadTreeNode<T> {
    protected x = 0;
    protected y = 0;
    protected radiW = 0;
    protected radiH = 0;
    protected level = 0;

    protected objects: Range<T>[] = [];

    protected topLeft: QuadTreeNode<T> | null = null;
    protected topRight: QuadTreeNode<T> | null = null;
    protected bottomLeft: QuadTreeNode<T> | null = null;
    protected bottomRight: QuadTreeNode<T> | null = null;

    protected constructor(x: number, y: number, radiW: number, radiH: number, level: number) {
        this.x = x;
        this.y = y;
        this.radiW = radiW;
        this.radiH = radiH;
        this.level = level;
    }

    protected _insert(object: Range<T>) {
        if (this.topLeft) {
            const top = object.y - object.radiH < this.y,
                bottom = object.y + object.radiH > this.y,
                left = object.x - object.radiW < this.x,
                right = object.x + object.radiW > this.x;

            if (top && left) this.topLeft._insert(object);
            if (top && right) this.topRight!._insert(object);
            if (bottom && left) this.bottomLeft!._insert(object);
            if (bottom && right) this.bottomRight!._insert(object);

            return;
        }

        this.objects.push(object);

        if (this.objects.length > 4 && this.level <= 9) {
            this._split();
        }
    }

    protected _split() {
        const halfW = this.radiW / 2,
            halfH = this.radiH / 2,
            level = this.level + 1;
        
        this.topLeft = new QuadTreeNode(this.x - halfW, this.y - halfH, halfW, halfH, level);
        this.topRight = new QuadTreeNode(this.x + halfW, this.y - halfH, halfW, halfH, level);
        this.bottomLeft = new QuadTreeNode(this.x - halfW, this.y + halfH, halfW, halfH, level);
        this.bottomRight = new QuadTreeNode(this.x + halfW, this.y + halfH, halfW, halfH, level);

        // Redistribute objects to child nodes
        for (const obj of this.objects) {
            const top = obj.y - obj.radiH < this.y,
                bottom = obj.y + obj.radiH > this.y,
                left = obj.x - obj.radiW < this.x,
                right = obj.x + obj.radiW > this.x;

            if (top && left) this.topLeft._insert(obj);
            if (top && right) this.topRight._insert(obj);
            if (bottom && left) this.bottomLeft._insert(obj);
            if (bottom && right) this.bottomRight._insert(obj);
        }

        // Clear objects from this node as they're now in children
        this.objects = [];
    }

    protected _retrieve(x: number, y: number, radiW: number, radiH: number): Range<T>[] {
        if (this.topLeft) {
            let out: Range<T>[] = [];
            const top = y - radiH < this.y,
                bottom = y + radiH > this.y,
                left = x - radiW < this.x,
                right = x + radiW > this.x;

            if (top && left) out.push(...this.topLeft._retrieve(x, y, radiW, radiH));
            if (top && right) out.push(...this.topRight!._retrieve(x, y, radiW, radiH));
            if (bottom && left) out.push(...this.bottomLeft!._retrieve(x, y, radiW, radiH));
            if (bottom && right) out.push(...this.bottomRight!._retrieve(x, y, radiW, radiH));
            
            return out;
        } else {
            return [...this.objects];
        }
    }
}

export default class DiepQuadTree extends QuadTreeNode<ObjectEntity> implements CollisionManager {
    public constructor(radiW: number, radiH: number) {
        super(0, 0, radiW, radiH, 0);
    }
    
    public insertEntity(entity: ObjectEntity) {
        this._insert({
            content: entity,
            x: entity.positionData.values.x,
            y: entity.positionData.values.y,
            radiW: entity.physicsData.values.sides === 2 ? entity.physicsData.values.size / 2 : entity.physicsData.values.size,
            radiH: entity.physicsData.values.sides === 2 ? entity.physicsData.values.width / 2 : entity.physicsData.values.size,
        });
    }

    public retrieve(x: number, y: number, radiW: number, radiH: number): ObjectEntity[] {
        const ranges = this._retrieve(x, y, radiW, radiH);
        const entities: ObjectEntity[] = [];
        const seen = new Set<ObjectEntity>();

        for (const range of ranges) {
            if (range.content.hash !== 0 && !seen.has(range.content)) {
                entities.push(range.content);
                seen.add(range.content);
            }
        }

        return entities;
    }

    public retrieveEntitiesByEntity(entity: ObjectEntity): ObjectEntity[] {
        return this.retrieve(
            entity.positionData.values.x,
            entity.positionData.values.y,
            entity.physicsData.values.sides === 2 ? entity.physicsData.values.size / 2 : entity.physicsData.values.size,
            entity.physicsData.values.sides === 2 ? entity.physicsData.values.width / 2 : entity.physicsData.values.size
        );
    }

    public reset(bottomY: number, rightX: number) {
        this.topLeft = this.topRight = this.bottomLeft = this.bottomRight = null;
        this.radiW = rightX;
        this.radiH = bottomY;
        this.objects = [];
    }
}