import { Vector2, Particle } from './types';

// Helper
const vAdd = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const vScale = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });

export function createBurst(pos: Vector2, count: number, color: string): Particle[] {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 150;
        particles.push({
            id: Math.random().toString(36).substr(2),
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            life: 1.0,
            maxLife: 0.5 + Math.random() * 0.5,
            color,
            size: 2 + Math.random() * 4
        });
    }
    return particles;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
    const alive: Particle[] = [];

    for (const p of particles) {
        p.life -= dt / p.maxLife;

        if (p.life > 0) {
            // physics
            p.pos = vAdd(p.pos, vScale(p.vel, dt));
            p.vel = vScale(p.vel, 0.95); // friction
            alive.push(p);
        }
    }

    return alive;
}
