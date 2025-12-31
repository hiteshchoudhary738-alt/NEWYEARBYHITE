(function () {
    const canvas = document.getElementById('A');
    if (!canvas) throw new Error("Canvas element with id 'A' not found.");
    const ctx = canvas.getContext('2d');

    // Helper functions for colors
    function hsl(h, s, l) { return `hsl(${h},${s},${l})`; }
    function hsla(h, s, l, a) { return `hsla(${h},${s},${l},${a})`; }

    const opts = {
        strings: ["HAPPY NEW YEAR", "2026 ✨✨"],
        charSize: 44,
        charSpacing: 62,
        lineHeight: 72,
        gravity: 0.12,
        upFlow: -0.06, // General upward drift for balloons

        // Letter Animation Settings
        fireworkPrevPoints: 10,
        fireworkBaseLineWidth: 5,
        fireworkAddedLineWidth: 6,
        fireworkSpawnTime: 120,
        fireworkBaseReachTime: 30,
        fireworkAddedReachTime: 30,
        fireworkCircleBaseSize: 20,
        fireworkCircleAddedSize: 10,
        fireworkCircleBaseTime: 30,
        fireworkCircleAddedTime: 20,
        fireworkCircleFadeBaseTime: 10,
        fireworkCircleFadeAddedTime: 5,
        fireworkBaseShards: 6,
        fireworkAddedShards: 6,
        fireworkShardPrevPoints: 3,
        fireworkShardBaseVel: 3,
        fireworkShardAddedVel: 2,
        fireworkShardBaseSize: 2,
        fireworkShardAddedSize: 2,
        letterContemplatingWaitTime: 200,
        balloonSpawnTime: 20,
        balloonBaseInflateTime: 10,
        balloonAddedInflateTime: 10,
        balloonBaseSize: 20,
        balloonAddedSize: 20,
        balloonBaseVel: 0.4,
        balloonAddedVel: 0.4,
        balloonBaseRadian: -(Math.PI / 2 - 0.5),
        balloonAddedRadian: -1.0,

        // --- NEW SETTINGS FOR BACKGROUND CRACKERS ---
        crackerChance: 0.025, // Chance per frame a cracker spawns (0.02 = 2%)
        crackerPrevPoints: 8, // Trail length
        crackerBaseLineWidth: 3,
        crackerAddedLineWidth: 4,
        crackerVyBase: -7, // Upward velocity
        crackerVyAdded: -4,
        crackerShardsBase: 15, // More shards than letters for bigger boom
        crackerShardsAdded: 20,
        crackerShardVelBase: 5, // Higher velocity for bigger explosion
        crackerShardVelAdded: 4,
        crackerShardSizeBase: 2.5,
        crackerShardSizeAdded: 3
    };

    let DPR = Math.max(window.devicePixelRatio || 1, 1);
    let w = innerWidth, h = innerHeight, hw = w / 2, hh = h / 2;
    let calc = { totalWidth: 0 };
    const Tau = Math.PI * 2;
    
    const letters = [];
    const crackers = []; // New Array for background crackers

    function setSize() {
        DPR = Math.max(window.devicePixelRatio || 1, 1);
        const cssW = Math.max(1, innerWidth);
        const cssH = Math.max(1, innerHeight);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.round(cssW * DPR);
        canvas.height = Math.round(cssH * DPR);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(DPR, DPR);
        w = cssW; h = cssH; hw = w / 2; hh = h / 2;
        
        ctx.font = `${opts.charSize}px Verdana`; 
        calc.totalWidth = opts.charSpacing * Math.max(...opts.strings.map(s => s.length));
    }

    function hueForX(x) {
        if (calc.totalWidth <= 0) return 40;
        const t = (x + calc.totalWidth / 2) / calc.totalWidth;
        return 30 + 25 * Math.min(Math.max(t, 0), 1);
    }

    // --- NEW CRACKER CLASS ---
    function Cracker() {
        this.x = (Math.random() * w * 0.8) - (w * 0.4); // Spawn randomly within 80% width
        this.y = hh + 50; // Start below screen
        this.vy = opts.crackerVyBase + opts.crackerVyAdded * Math.random();
        this.hue = Math.random() * 360; // Random distinct color
        this.color = hsl(this.hue, '100%', '60%');
        this.alphaColor = (alp) => hsla(this.hue, '100%', '60%', alp);
        this.lineWidth = opts.crackerBaseLineWidth + opts.crackerAddedLineWidth * Math.random();
        this.prevPoints = [[this.x, this.y, this.lineWidth]];
        this.phase = 'ascending';
        this.shards = [];
    }

    Cracker.prototype.step = function() {
        if (this.phase === 'ascending') {
            this.prevPoints.push([this.x, this.y, this.lineWidth]);
            if (this.prevPoints.length > opts.crackerPrevPoints) this.prevPoints.shift();
            
            this.y += this.vy;
            this.vy += opts.gravity * 0.6; // Less gravity while ascending

            // Draw trail
            const lwp = 1 / Math.max(1, this.prevPoints.length - 1);
            for (let i = 1; i < this.prevPoints.length; ++i) {
                const p = this.prevPoints[i], p2 = this.prevPoints[i - 1];
                ctx.strokeStyle = this.alphaColor((i / this.prevPoints.length) * 0.8);
                ctx.lineWidth = p[2] * lwp * i;
                ctx.beginPath();
                ctx.moveTo(p[0], p[1]);
                ctx.lineTo(p2[0], p2[1]);
                ctx.stroke();
            }

            // Explode when velocity gets near zero (apex of flight)
            if (this.vy >= -0.5) {
                this.phase = 'exploding';
                const shardCount = Math.floor(opts.crackerShardsBase + opts.crackerShardsAdded * Math.random());
                const angleStep = Tau / shardCount;
                for (let i = 0; i < shardCount; ++i) {
                    const angle = angleStep * i + (Math.random() * 0.5);
                    const vel = opts.crackerShardVelBase + opts.crackerShardVelAdded * Math.random();
                    const vx = Math.cos(angle) * vel;
                    const vy = Math.sin(angle) * vel;
                    // Use the Shard class, but pass "true" for isCrackerShard to use different sizes
                    this.shards.push(new Shard(this.x, this.y, vx, vy, this.color, true));
                }
            }
        } else if (this.phase === 'exploding') {
            let allDead = true;
            for (let i = 0; i < this.shards.length; ++i) {
                this.shards[i].step();
                if (this.shards[i].alive) allDead = false;
            }
            if (allDead) this.phase = 'done';
        }
    }
    // -------------------------

    function Letter(char, x, y) {
        this.char = char;
        this.x = x;
        this.y = y;
        this.dx = -ctx.measureText(char).width / 2;
        this.dy = opts.charSize / 2;
        this.fireworkDy = this.y - hh;
        const hue = hueForX(x);
        this.hue = hue;
        
        this.color = hsl(hue, '90%', '50%');
        this.lightColor = (light) => hsl(hue, '90%', `${light}%`);
        this.alphaColor = (alp) => hsla(hue, '90%', '52%', alp);
        this.lightAlpha = (light, alp) => hsla(hue, '90%', `${light}%`, alp);
        this.reset();
    }

    Letter.prototype.reset = function () {
        this.phase = 'firework';
        this.tick = 0;
        this.spawned = false;
        this.spawningTime = Math.floor(opts.fireworkSpawnTime * Math.random());
        this.reachTime = Math.floor(opts.fireworkBaseReachTime + opts.fireworkAddedReachTime * Math.random());
        this.lineWidth = opts.fireworkBaseLineWidth + opts.fireworkAddedLineWidth * Math.random();
        this.prevPoints = [[0, hh, 0]];
    };

    Letter.prototype.step = function () {
        if (this.phase === 'firework') {
            if (!this.spawned) {
                ++this.tick;
                if (this.tick >= this.spawningTime) { this.tick = 0; this.spawned = true; }
            } else {
                ++this.tick;
                const lp = this.tick / Math.max(1, this.reachTime);
                const ap = Math.sin(lp * (Tau / 4));
                const x = lp * this.x;
                const y = hh + ap * this.fireworkDy;
                if (this.prevPoints.length > opts.fireworkPrevPoints) this.prevPoints.shift();
                this.prevPoints.push([x, y, lp * this.lineWidth]);
                const lwp = 1 / Math.max(1, this.prevPoints.length - 1);
                for (let i = 1; i < this.prevPoints.length; ++i) {
                    const p = this.prevPoints[i], p2 = this.prevPoints[i - 1];
                    ctx.strokeStyle = this.alphaColor((i / this.prevPoints.length) * 0.9);
                    ctx.lineWidth = p[2] * lwp * i;
                    ctx.beginPath();
                    ctx.moveTo(p[0], p[1]);
                    ctx.lineTo(p2[0], p2[1]);
                    ctx.stroke();
                }
                if (this.tick >= this.reachTime) {
                    this.phase = 'contemplate';
                    this.circleFinalSize = opts.fireworkCircleBaseSize + opts.fireworkCircleAddedSize * Math.random();
                    this.circleCompleteTime = Math.floor(opts.fireworkCircleBaseTime + opts.fireworkCircleAddedTime * Math.random());
                    this.circleCreating = true; this.circleFading = false;
                    this.circleFadeTime = Math.floor(opts.fireworkCircleFadeBaseTime + opts.fireworkCircleFadeAddedTime * Math.random());
                    this.tick = 0; this.tick2 = 0;
                    this.shards = [];
                    const shardCount = Math.max(5, Math.floor(opts.fireworkBaseShards + opts.fireworkAddedShards * Math.random()));
                    const angle = (Tau / shardCount);
                    let cos = Math.cos(angle), sin = Math.sin(angle);
                    let vx = 1, vy = 0;
                    for (let i = 0; i < shardCount; ++i) {
                        const vx1 = vx;
                        vx = vx * cos - vy * sin;
                        vy = vx1 * sin + vy * cos;
                        this.shards.push(new Shard(this.x, this.y, vx, vy, this.alphaColor(1), false));
                    }
                }
            }
        } else if (this.phase === 'contemplate') {
            ++this.tick;
            if (this.circleCreating) {
                ++this.tick2;
                const proportion = this.tick2 / Math.max(1, this.circleCompleteTime);
                const armonic = -Math.cos(proportion * Math.PI) / 2 + 0.5;
                ctx.beginPath();
                ctx.fillStyle = this.lightAlpha(40 + 60 * proportion, proportion);
                ctx.arc(this.x, this.y, armonic * this.circleFinalSize, 0, Tau);
                ctx.fill();
                if (this.tick2 > this.circleCompleteTime) {
                    this.tick2 = 0; this.circleCreating = false; this.circleFading = true;
                }
            } else if (this.circleFading) {
                ctx.save();
                ctx.shadowBlur = 18;
                ctx.shadowColor = 'rgba(255,200,110,0.9)';
                ctx.fillStyle = this.lightColor(76);
                ctx.fillText(this.char, this.x + this.dx, this.y + this.dy);
                ctx.restore();
                ++this.tick2;
                const proportion = this.tick2 / Math.max(1, this.circleFadeTime);
                const armonic = -Math.cos(proportion * Math.PI) / 2 + 0.5;
                ctx.beginPath();
                ctx.fillStyle = this.lightAlpha(100, 1 - armonic);
                ctx.arc(this.x, this.y, this.circleFinalSize, 0, Tau);
                ctx.fill();
                if (this.tick2 >= this.circleFadeTime) this.circleFading = false;
            } else {
                ctx.save();
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255,190,80,0.85)';
                ctx.fillStyle = this.lightColor(72);
                ctx.fillText(this.char, this.x + this.dx, this.y + this.dy);
                ctx.restore();
            }
            for (let i = 0; i < this.shards.length; ++i) {
                this.shards[i].step();
                if (!this.shards[i].alive) { this.shards.splice(i, 1); --i; }
            }
            if (this.tick > opts.letterContemplatingWaitTime) {
                this.phase = 'balloon';
                this.tick = 0; this.spawning = true;
                this.spawnTime = Math.floor(opts.balloonSpawnTime * Math.random());
                this.inflating = false;
                this.inflateTime = Math.floor(opts.balloonBaseInflateTime + opts.balloonAddedInflateTime * Math.random());
                this.size = Math.floor(opts.balloonBaseSize + opts.balloonAddedSize * Math.random());
                const rad = opts.balloonBaseRadian + opts.balloonAddedRadian * Math.random();
                const vel = opts.balloonBaseVel + opts.balloonAddedVel * Math.random();
                this.vx = Math.cos(rad) * vel;
                this.vy = Math.sin(rad) * vel;
                this.cx = this.x; this.cy = this.y;
            }
        } else if (this.phase === 'balloon') {
            ctx.strokeStyle = this.lightColor(82);
            ctx.lineWidth = 1.2;
            if (this.spawning) {
                ++this.tick;
                ctx.fillStyle = this.lightColor(72);
                ctx.fillText(this.char, this.x + this.dx, this.y + this.dy);
                if (this.tick >= this.spawnTime) { this.tick = 0; this.spawning = false; this.inflating = true; }
            } else if (this.inflating) {
                ++this.tick;
                const proportion = this.tick / Math.max(1, this.inflateTime);
                const x = (this.cx = this.x);
                const y = (this.cy = this.y - this.size * proportion);
                ctx.fillStyle = this.alphaColor(proportion * 0.9);
                ctx.beginPath();
                generateBalloonPath(ctx, x, y, this.size * proportion);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, this.y);
                ctx.stroke();
                ctx.fillStyle = this.lightColor(70);
                ctx.fillText(this.char, this.x + this.dx, this.y + this.dy);
                if (this.tick >= this.inflateTime) { this.tick = 0; this.inflating = false; }
            } else {
                this.cx += this.vx;
                this.cy += (this.vy += opts.upFlow);
                ctx.fillStyle = this.color;
                ctx.beginPath();
                generateBalloonPath(ctx, this.cx, this.cy, this.size);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(this.cx, this.cy);
                ctx.lineTo(this.cx, this.cy + this.size);
                ctx.stroke();
                ctx.fillStyle = this.lightColor(76);
                ctx.fillText(this.char, this.cx + this.dx, this.cy + this.dy + this.size);
                if (this.cy + this.size < -hh - 120 || this.cx < -hw - 120 || this.cx > hw + 120) this.phase = 'done';
            }
        }
    };

    // UPDATED SHARD: Accepts a flag to determine size based on if it's a background cracker or a letter
    function Shard(x, y, vx, vy, color, isCrackerShard) {
        this.vx = vx; this.vy = vy;
        this.x = x; this.y = y;
        this.prevPoints = [[x, y]];
        this.color = color;
        this.alive = true;
        // Determine size based on type
        const base = isCrackerShard ? opts.crackerShardSizeBase : opts.fireworkShardBaseSize;
        const added = isCrackerShard ? opts.crackerShardSizeAdded : opts.fireworkShardAddedSize;
        this.size = base + added * Math.random();
    }
    Shard.prototype.step = function () {
        this.x += this.vx; this.y += this.vy += opts.gravity;
        if (this.prevPoints.length > opts.fireworkShardPrevPoints) this.prevPoints.shift();
        this.prevPoints.push([this.x, this.y]);
        const lwp = this.size / Math.max(1, this.prevPoints.length);
        for (let k = 0; k < this.prevPoints.length - 1; ++k) {
            const p = this.prevPoints[k], p2 = this.prevPoints[k + 1];
            ctx.strokeStyle = this.color;
            // Added transparency to tails for smoother look
            ctx.globalAlpha = (k + 1) / this.prevPoints.length;
            ctx.lineWidth = (k + 1) * lwp * 0.6;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
        }
         ctx.globalAlpha = 1; // Reset alpha
        if (this.prevPoints[0][1] > hh + 60 || this.x < -hw -60 || this.x > hw + 60) this.alive = false;
    };

    function generateBalloonPath(ctx, x, y, size) {
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x - size / 2, y - size / 2, x - size / 4, y - size, x, y - size);
        ctx.bezierCurveTo(x + size / 4, y - size, x + size / 2, y - size / 2, x, y);
    }

    function createLetters() {
        letters.length = 0;
        const rows = opts.strings.length;
        const longest = Math.max(...opts.strings.map(s => s.length));
        calc.totalWidth = opts.charSpacing * longest;
        const blockHeight = opts.lineHeight * rows;
        for (let i = 0; i < rows; ++i) {
            const str = opts.strings[i];
            const rowWidth = opts.charSpacing * str.length;
            const xOffset = -rowWidth / 2 + opts.charSpacing / 2;
            const y = i * opts.lineHeight + opts.lineHeight / 2 - blockHeight / 2;
            for (let j = 0; j < str.length; ++j) {
                letters.push(new Letter(str[j], xOffset + j * opts.charSpacing, y));
            }
        }
    }

    function animate() {
        window.requestAnimationFrame(animate);
        
        // --- 1. Background Clearing & Gradient ---
        ctx.save();
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);

        const g = ctx.createRadialGradient(hw, hh, 0, hw, hh, Math.max(w, h) * 0.9);
        g.addColorStop(0, 'rgba(255,190,80,0.06)');
        g.addColorStop(0.25, 'rgba(255,160,60,0.03)');
        g.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width / DPR, canvas.height / DPR);
        ctx.restore();

        // --- Setup for drawing ---
        ctx.save();
        ctx.translate(hw, hh);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // --- 2. Manage Background Crackers ---
        // Randomly spawn new ones
        if (Math.random() < opts.crackerChance) {
            crackers.push(new Cracker());
        }
        // Update and draw existing ones
        for (let i = 0; i < crackers.length; ++i) {
            crackers[i].step();
            if (crackers[i].phase === 'done') {
                crackers.splice(i, 1);
                --i;
            }
        }

        // --- 3. Manage Letter Animation ---
        ctx.font = `${opts.charSize}px Verdana`;
        let allDone = true;
        for (let i = 0; i < letters.length; ++i) {
            letters[i].step();
            if (letters[i].phase !== 'done') allDone = false;
        }

        ctx.restore();

        if (allDone) {
            setTimeout(() => { for (let L of letters) L.reset(); }, 400);
        }
    }

    setSize();
    window.addEventListener('resize', () => {
        window.requestAnimationFrame(() => { setSize(); createLetters(); });
    }, { passive: true });

    createLetters();
    animate();
})();