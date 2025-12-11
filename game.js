// Enhanced Void Invaders: Galactic Grind v4.0 - Mobile Immersive Edition (Fixed)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const elements = {
    score: document.getElementById('score'), way4Shards: document.getElementById('way4Shards'),
    coin4Shards: document.getElementById('coin4Shards'), tr3bShards: document.getElementById('tr3bShards'),
    wave: document.getElementById('wave'), walletStatus: document.getElementById('walletStatus')
};
const buttons = {
    connect: document.getElementById('connectWallet'), upgradeCoin4: document.getElementById('upgradeCoin4'),
    escapeWay4: document.getElementById('escapeWay4'), scanTr3b: document.getElementById('scanTr3b'),
    redeemWay4: document.getElementById('redeemWay4'), redeemCoin4: document.getElementById('redeemCoin4'),
    redeemTr3b: document.getElementById('redeemTr3b'), claimAirdrop: document.getElementById('claimAirdrop'),
    mintNFT: document.getElementById('mintNFT'), watchAd: document.getElementById('watchAd'),
    joinDAO: document.getElementById('joinDAO'), fullScreen: document.getElementById('fullScreen'),
    toggleMusic: document.getElementById('toggleMusic')
};

let web3, account, contracts = {};
const CHAIN_ID = 8453;
const REWARD_ADDRESS = '0xCeA57eEdA6eF19ce51caBE00e4CF425a31802D74';
const NFT_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // Placeholder - deploy real
const NFT_ABI = [{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"safeMint","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const ERC20_ABI = [{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"balance","type":"uint256"}],"stateMutability":"view","type":"function"},
{"inputs":[{"internalType":"address","name":"_to","type":"address"},{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
{"inputs":[{"internalType":"uint256","name":"_value","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}];

const CONTRACTS = {
    WAY4OUT: { address: '0xd07379a755a8f11b57610154861d694b2a0f615a', abi: ERC20_ABI, decimals: 18 },
    COIN4: { address: '0x4deeba0fca2f9a8b307b891241eac57b6bf713ec', abi: ERC20_ABI, decimals: 18 },
    TR3B: { address: '0x98a8165a44782ab43c378ed9f501d55ec51b2880', abi: ERC20_ABI, decimals: 18 }
};

let gameState = JSON.parse(localStorage.getItem('voidInvaders')) || {
    score: 0, way4Shards: 0, coin4Shards: 0, tr3bShards: 0, wave: 1, highScore: 0,
    player: { x: 375, y: 550, width: 50, height: 20, speed: 8, shields: 1, powerUp: null },
    upgrades: { laserSpeed: 1, escapeUsed: false }, airdropClaimed: false
};
let invaders = [], bullets = [], invaderBullets = [], barriers = [], particles = [], powerUps = [];
let keys = {}, touchX = 0, touchY = 0, touchActive = false, music = document.getElementById('bgMusic'), musicPlaying = false;
let audioCtx, nextDrop = 'WAY4OUT';

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.player.x = canvas.width / 2 - 25;
    gameState.player.y = canvas.height - 50;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function init() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    initInvaders();
    initBarriers();
    updateDisplay();
    requestAnimationFrame(gameLoop);
    loadContracts();
    if (gameState.wave % 10 === 0) dailyEvent();
}
async function loadContracts() {
    if (!web3) return;
    Object.keys(CONTRACTS).forEach(key => {
        contracts[key] = new web3.eth.Contract(CONTRACTS[key].abi, CONTRACTS[key].address);
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updatePlayer();
    updateInvaders();
    updateBullets();
    updateInvaderBullets();
    updateBarriers();
    updateParticles();
    updatePowerUps();
    checkCollisions();
    drawAll();
    saveState();
    requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    if (touchActive) {
        const dx = touchX - gameState.player.x - gameState.player.width / 2;
        gameState.player.x += dx * 0.1;
        gameState.player.x = Math.max(0, Math.min(canvas.width - gameState.player.width, gameState.player.x));
    } else {
        if (keys['ArrowLeft']) gameState.player.x = Math.max(0, gameState.player.x - gameState.player.speed);
        if (keys['ArrowRight']) gameState.player.x = Math.min(canvas.width - gameState.player.width, gameState.player.x + gameState.player.speed);
    }
    ctx.fillStyle = gameState.player.shields > 1 ? '#0ff' : '#0f0';
    ctx.fillRect(gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
}

function initInvaders() {
    invaders = [];
    const rows = Math.min(5 + gameState.wave / 2, 10), cols = 10;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            invaders.push({ x: 50 + j * 60, y: 50 + i * 40, width: 40, height: 20, dir: 1, shootTimer: Math.random() * 100 });
        }
    }
    if (gameState.wave % 5 === 0) initBoss();
}
function updateInvaders() {
    let edge = false;
    invaders.forEach(inv => {
        inv.x += inv.dir * (0.5 + gameState.wave * 0.1);
        if (inv.x > canvas.width - inv.width || inv.x < 0) edge = true;
        inv.shootTimer++;
        if (inv.shootTimer > 200 - gameState.wave * 5 && Math.random() < 0.02) {
            invaderBullets.push({ x: inv.x + 20, y: inv.y + 20, speed: 3 });
            inv.shootTimer = 0; playSound(200, 0.1);
        }
        if (Math.random() < 0.001 * gameState.wave) dropPowerUp(inv.x, inv.y);
    });
    if (edge) {
        invaders.forEach(inv => { inv.dir *= -1; inv.y += 30; });
        if (invaders[0] && invaders[0].y > canvas.height - 200) gameOver();
    }
    if (invaders.length === 0) { gameState.wave++; gameState.score += 1000 * gameState.wave; initInvaders(); dailyEvent(); }
}

function updateBullets() {
    bullets.forEach((b, i) => {
        b.y -= 10 * gameState.upgrades.laserSpeed;
        if (b.y < 0) bullets.splice(i, 1);
    });
    invaderBullets.forEach((b, i) => {
        b.y += b.speed;
        if (b.y > canvas.height) invaderBullets.splice(i, 1);
    });
}

function initBarriers() {
    barriers = [];
    for (let i = 0; i < 3; i++) {
        barriers.push({ x: canvas.width / 4 + i * (canvas.width / 4), y: canvas.height - 100, width: 100, height: 20, health: 3 });
    }
}

function createParticles(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push({ x, y, vx: Math.random() * 6 - 3, vy: Math.random() * 6 - 3, life: 30, color: '#0f0' });
    }
    if ('vibrate' in navigator) navigator.vibrate(50);
}
function updateParticles() {
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    });
}

function dropPowerUp(x, y) {
    const types = ['triple', 'shield'];
    powerUps.push({ x, y, type: types[Math.floor(Math.random() * types.length)], speed: 2 });
}
function updatePowerUps() {
    powerUps.forEach((pu, i) => {
        pu.y += pu.speed;
        if (pu.y > canvas.height) powerUps.splice(i, 1);
        if (pu.x > gameState.player.x && pu.x < gameState.player.x + gameState.player.width && pu.y > gameState.player.y && pu.y < gameState.player.y + gameState.player.height) {
            powerUps.splice(i, 1);
            gameState.player.powerUp = pu.type;
            setTimeout(() => gameState.player.powerUp = null, 10000);
            alert(pu.type === 'triple' ? 'Triple Shot!' : 'Invincibility Shield!');
        }
    });
}

function checkCollisions() {
    bullets.forEach((b, bi) => {
        invaders.forEach((inv, ii) => {
            if (b.x > inv.x && b.x < inv.x + inv.width && b.y > inv.y && b.y < inv.y + inv.height) {
                invaders.splice(ii, 1); bullets.splice(bi, 1);
                gameState.score += 10; dropShard(); playSound(800, 0.2); createParticles(inv.x + inv.width / 2, inv.y + inv.height / 2);
            }
        });
        barriers.forEach((bar, bai) => {
            if (b.x > bar.x && b.x < bar.x + bar.width && b.y > bar.y && b.y < bar.y + bar.height) {
                bullets.splice(bi, 1);
            }
        });
    });
    invaderBullets.forEach((ib, ii) => {
        if (ib.x > gameState.player.x && ib.x < gameState.player.x + gameState.player.width &&
            ib.y > gameState.player.y && ib.y < gameState.player.y + gameState.player.height) {
            invaderBullets.splice(ii, 1); damagePlayer();
        }
        barriers.forEach((bar, bai) => {
            if (ib.x > bar.x && ib.x < bar.x + bar.width && ib.y > bar.y && ib.y < bar.y + bar.height) {
                invaderBullets.splice(ii, 1); bar.health--; if (bar.health <= 0) barriers.splice(bai, 1);
            }
        });
    });
}

function dropShard() {
    const coins = ['way4Shards', 'coin4Shards', 'tr3bShards'];
    gameState[coins[Math.floor(Math.random() * 3)]]++;
    playSound(600, 0.15);
}

function damagePlayer() {
    if (gameState.player.powerUp === 'shield') return;
    gameState.player.shields--;
    if (gameState.player.shields <= 0) {
        gameOver();
    } else {
        playSound(100, 0.3); if ('vibrate' in navigator) navigator.vibrate(100);
    }
}
function gameOver() {
    alert(`Game Over! Score: ${gameState.score}. High: ${gameState.highScore}`);
    location.reload();
}

function shoot() {
    const x = gameState.player.x + gameState.player.width / 2;
    bullets.push({ x, y: gameState.player.y });
    if (gameState.player.powerUp === 'triple') {
        bullets.push({ x: x - 10, y: gameState.player.y });
        bullets.push({ x: x + 10, y: gameState.player.y });
    }
    playSound(1000, 0.1);
}

function drawAll() {
    ctx.fillStyle = gameState.player.shields > 1 ? '#0ff' : '#0f0';
    ctx.fillRect(gameState.player.x, gameState.player.y, gameState.player.width, gameState.player.height);
    ctx.fillStyle = '#f00';
    invaders.forEach(inv => ctx.fillRect(inv.x, inv.y, inv.width, inv.height));
    ctx.fillStyle = '#fff'; bullets.forEach(b => ctx.fillRect(b.x, b.y, 3, 8));
    ctx.fillStyle = '#f80'; invaderBullets.forEach(b => ctx.fillRect(b.x, b.y, 3, 8));
    ctx.fillStyle = '#0a0'; barriers.forEach(bar => ctx.fillRect(bar.x, bar.y, bar.width, bar.height));
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2); });
    powerUps.forEach(pu => { ctx.fillStyle = pu.type === 'triple' ? '#ff0' : '#0ff'; ctx.fillRect(pu.x, pu.y, 20, 20); });
}

document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ') shoot();
});
document.addEventListener('keyup', e => keys[e.key] = false);
canvas.addEventListener('touchstart', e => {
    touchActive = true;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    if (touchY < canvas.height / 2) shoot();
    e.preventDefault();
});
canvas.addEventListener('touchmove', e => {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    e.preventDefault();
});
canvas.addEventListener('touchend', e => touchActive = false);

function playSound(freq, duration) {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = freq; gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

function updateDisplay() {
    elements.score.textContent = gameState.score;
    elements.way4Shards.textContent = gameState.way4Shards;
    elements.coin4Shards.textContent = gameState.coin4Shards;
    elements.tr3bShards.textContent = gameState.tr3bShards;
    elements.wave.textContent = gameState.wave;
    if (gameState.score > gameState.highScore) gameState.highScore = gameState.score;
}
function saveState() { localStorage.setItem('voidInvaders', JSON.stringify(gameState)); }

function dailyEvent() {
    const bonus = Math.floor(Math.random() * 5) + 1;
    gameState.way4Shards += bonus; gameState.coin4Shards += bonus; gameState.tr3bShards += bonus;
    alert(`Event Airdrop: +${bonus} shards each!`);
}

function initBoss() {
    invaders.push({ x: canvas.width / 2 - 50, y: 50, width: 100, height: 40, dir: 1, health: 50, isBoss: true });
}

async function connectWallet() {
    if (!window.ethereum) return alert('Install MetaMask!');
    try {
        await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x2105', chainName: 'Base', rpcUrls: ['https://mainnet.base.org'], nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, blockExplorerUrls: ['https://basescan.org'] }] });
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        account = accounts[0]; web3 = new Web3(window.ethereum);
        elements.walletStatus.textContent = `Wallet: ${account.slice(0,6)}...${account.slice(-4)}`;
        buttons.connect.disabled = true; loadContracts();
        if (!gameState.airdropClaimed) claimAirdrop();
    } catch (err) { alert('Connect failed: ' + err.message); }
}
buttons.connect.onclick = connectWallet;

function claimAirdrop() {
    if (!gameState.airdropClaimed) {
        gameState.way4Shards += 10; gameState.coin4Shards += 10; gameState.tr3bShards += 10;
        gameState.airdropClaimed = true; updateDisplay(); saveState();
        alert('Airdrop claimed: 10 shards each!');
    } else alert('Already claimed!');
}
buttons.claimAirdrop.onclick = claimAirdrop;

async function redeemToken(tokenKey) {
    if (!account || gameState[`${tokenKey.toLowerCase()}Shards`] === 0) return alert('Connect & earn!');
    try {
        const contract = contracts[tokenKey]; 
        let amount = web3.utils.toWei(gameState[`${tokenKey.toLowerCase()}Shards`].toString(), 'ether');
        const fee = amount / 20; amount -= fee;
        const gasEst = await contract.methods.transfer(REWARD_ADDRESS, amount).estimateGas({ from: account });
        if (contract.methods.burn) await contract.methods.burn(fee).send({ from: account });
        await contract.methods.transfer(REWARD_ADDRESS, amount).send({ from: account, gas: gasEst });
        gameState[`${tokenKey.toLowerCase()}Shards`] = 0; updateDisplay(); alert(`${tokenKey} redeemed (5% burn)!`);
    } catch (err) { alert('Redeem failed: ' + err.message); }
}
buttons.redeemWay4.onclick = () => redeemToken('WAY4OUT');
buttons.redeemCoin4.onclick = () => redeemToken('COIN4');
buttons.redeemTr3b.onclick = () => redeemToken('TR3B');

buttons.upgradeCoin4.onclick = () => {
    if (gameState.coin4Shards >= 1) {
        gameState.coin4Shards--; gameState.upgrades.laserSpeed *= 4; setTimeout(() => gameState.upgrades.laserSpeed /= 4, 10000);
        alert('Quad Boost activated! 4x fire for 10s.');
    } else alert('Need $COIN4 shard!');
};

buttons.escapeWay4.onclick = () => {
    if (gameState.way4Shards >= 1) {
        gameState.way4Shards--; gameState.upgrades.escapeUsed = true; gameState.wave = Math.max(1, gameState.wave - 1);
        initInvaders(); alert('Warped! Wave reset.');
    } else alert('Need $WAY4OUT!');
};

buttons.scanTr3b.onclick = () => {
    if (gameState.tr3bShards >= 1) {
        gameState.tr3bShards--; nextDrop = ['WAY4OUT', 'COIN4', 'TR3B'][Math.floor(Math.random() * 3)]; alert(`Oracle: Next drop ${nextDrop}!`);
    } else alert('Need $TR3B shard!');
};

buttons.fullScreen.onclick = () => {
    if (canvas.requestFullscreen) canvas.requestFullscreen();
};
buttons.toggleMusic.onclick = () => {
    if (musicPlaying) { music.pause(); musicPlaying = false; } else { music.play(); musicPlaying = true; }
};
buttons.watchAd.onclick = () => { gameState.way4Shards += 5; updateDisplay(); alert('Ad watched: +5 $WAY4OUT shards!'); };
buttons.joinDAO.onclick = () => window.open('https://x.com/way4outt', '_blank');
buttons.mintNFT.onclick = async () => {
    if (!account) return alert('Connect!');
    try {
        const tokenId = Date.now();
        const nftContract = new web3.eth.Contract(NFT_ABI, NFT_CONTRACT_ADDRESS);
        await nftContract.methods.safeMint(account, tokenId).send({ from: account, value: web3.utils.toWei('0.001', 'ether') });
        alert('Bunker NFT minted!');
    } catch (err) { alert('Mint failed: ' + err.message); }
};

init();
