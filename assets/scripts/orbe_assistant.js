(function() {
	const canvas = document.getElementById('gbcCanvas');
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;

	const container = document.getElementById('gbcSphereContainer');

	// --- ELEMENTOS DO BALÃO E CHAT MODAL ---
	const speechBubble = document.getElementById('gbcSpeechBubble');
	const speechTextEl = document.getElementById('gbcSpeechText');
	const closeSpeechBtn = document.getElementById('closeSpeechBubble');

	const orbChatModal = document.getElementById('orbChatModal');
	const closeOrbChat = document.getElementById('closeOrbChat');
	const orbChatForm = document.getElementById('orbChatForm');
	const orbChatInput = document.getElementById('orbChatInput');
	const orbChatHistory = document.getElementById('orbChatHistory');

	// Deteta se é um dispositivo móvel/tablet (sem hover de rato)
	const isTouchDevice = window.matchMedia('(hover: none)').matches || window.innerWidth <= 768;

	// Mensagens variadas para saudações ao aproximar
	const orbGreetings = [
		"Saudações, Herói! Sou o Orbe de Acesso. Clica em mim para abrires o chat!",
		"Procuras saber mais sobre o Pedro Santos? Clica em mim para conversarmos!",
		"Dica: Podes explorar as abas acima para ver projetos, experiências e estudos!",
		"Tenho todo o conhecimento sobre as habilidades do Pedro. Pergunta-me algo ao clicar no orbe!",
		"O sistema opera com estabilidade máxima nas runas de código. Em que posso ajudar?"
	];

	let isBubbleManuallyClosed = false;
	let wasFarAway = true; // Controla quando o rato se afasta para sortear nova frase ao voltar

	// Se for mobile/tablet, abre o balão de boas-vindas logo ao carregar
	if (isTouchDevice && speechBubble) {
		speechBubble.classList.add('ativo');
	}

	// Botão para fechar o balão (essencial em mobile/tablet e desktop)
	if (closeSpeechBtn) {
		closeSpeechBtn.addEventListener('click', (e) => {
			e.stopPropagation(); // EVITA que o clique no X abra a janela do chat!
			isBubbleManuallyClosed = true;
			if (speechBubble) speechBubble.classList.remove('ativo');
		});
	}

	const PALETTES = {
		CYAN: { c0: '#ffffff', c1: '#67e8f9', c2: '#0284c7', c3: '#0f172a' },
		VIOLET: { c0: '#ffffff', c1: '#f472b6', c2: '#a855f7', c3: '#3b0764' },
		GOLD: { c0: '#ffffff', c1: '#fef08a', c2: '#f59e0b', c3: '#451a03' }
	};

	function hexToRgb(hex) {
		let bigint = parseInt(hex.replace('#', ''), 16);
		return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
	}

	function rgbToHex(r, g, b) {
		return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
	}

	function lerpColor(c1, c2, t) {
		let rgb1 = hexToRgb(c1);
		let rgb2 = hexToRgb(c2);
		return rgbToHex(
			rgb1.r + (rgb2.r - rgb1.r) * t,
			rgb1.g + (rgb2.g - rgb1.g) * t,
			rgb1.b + (rgb2.b - rgb1.b) * t
		);
	}

	let targetPaletteKey = 'CYAN';
	let currentPalette = { c0: PALETTES.CYAN.c0, c1: PALETTES.CYAN.c1, c2: PALETTES.CYAN.c2, c3: PALETTES.CYAN.c3 };

	let mouseX = window.innerWidth / 2;
	let mouseY = window.innerHeight / 2;
	let lastMouseX = mouseX;
	let lastMouseY = mouseY;
	let mouseSpeed = 0;

	let isHovered = false;
	let isClicking = false;
	let isIdle = false;
	let idleTimer = null;

	let coreX = 80;
	let coreY = 80;

	let clickFlareRadius = 0;
	let particles = [];
	let pulsePhase = 0;

	class PixelSpark {
		constructor(x, y, vx, vy) {
			this.x = x; this.y = y; this.vx = vx; this.vy = vy;
			this.size = Math.random() > 0.5 ? 2 : 3;
			this.life = 1.0;
			this.decay = Math.random() * 0.05 + 0.025;
		}
		update() { this.x += this.vx; this.y += this.vy; this.life -= this.decay; }
		draw(ctx, palette) {
			if (this.life <= 0) return;
			ctx.fillStyle = this.life > 0.5 ? palette.c0 : palette.c1;
			ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
		}
	}

	window.addEventListener('mousemove', (e) => {
		mouseX = e.clientX;
		mouseY = e.clientY;

		const dx = mouseX - lastMouseX;
		const dy = mouseY - lastMouseY;
		mouseSpeed = Math.hypot(dx, dy);
		lastMouseX = mouseX;
		lastMouseY = mouseY;

		resetIdleTimer();

		const rect = container.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const dist = Math.hypot(mouseX - centerX, mouseY - centerY);

		if (mouseSpeed > 3 && dist < 260) {
			const angle = Math.atan2(mouseY - centerY, mouseX - centerX);
			const spawnX = 80 + Math.cos(angle) * 32;
			const spawnY = 80 + Math.sin(angle) * 32;

			particles.push(new PixelSpark(
				spawnX, spawnY,
				(Math.random() - 0.5) * 1.5 + dx * 0.05,
				(Math.random() - 0.5) * 1.5 + dy * 0.05
			));
		}
	});

	container.addEventListener('mouseenter', () => {
		isHovered = true;
		if (!isClicking) targetPaletteKey = 'VIOLET';
	});

	container.addEventListener('mouseleave', () => {
		isHovered = false;
		if (!isClicking) targetPaletteKey = 'CYAN';
	});

	// --- AO CLICAR NO ORBE: ABRE O MODAL DE CHATBOT ---
	container.addEventListener('click', () => {
		isClicking = true;
		targetPaletteKey = 'GOLD';
		clickFlareRadius = 4;

		// Oculta o balão flutuante e abre o modal de chat
		if (speechBubble) speechBubble.classList.remove('ativo');
		if (orbChatModal) orbChatModal.classList.add('ativo');

		container.classList.remove('gbc-shake');
		void container.offsetWidth;
		container.classList.add('gbc-shake');

		for (let i = 0; i < 12; i++) {
			const pAngle = (Math.PI * 2 / 12) * i;
			const spd = Math.random() * 2 + 1;
			particles.push(new PixelSpark(80, 80, Math.cos(pAngle) * spd, Math.sin(pAngle) * spd));
		}

		setTimeout(() => {
			isClicking = false;
			targetPaletteKey = isHovered ? 'VIOLET' : 'CYAN';
		}, 350);
	});

	// Fechar Modal do Chatbot
	if (closeOrbChat) {
		closeOrbChat.addEventListener('click', () => {
			if (orbChatModal) orbChatModal.classList.remove('ativo');
		});
	}

	window.addEventListener('click', (e) => {
		if (e.target === orbChatModal) orbChatModal.classList.remove('ativo');
	});

	// Lógica do envio de mensagens no Chatbot
	if (orbChatForm) {
		orbChatForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const userQuery = orbChatInput.value.trim();
			if (!userQuery) return;

			// Adiciona mensagem do utilizador
			const userMsgDiv = document.createElement('div');
			userMsgDiv.className = 'chat-msg user-msg';
			userMsgDiv.innerHTML = `<span class="chat-sender">[TU]:</span> ${userQuery}`;
			orbChatHistory.appendChild(userMsgDiv);

			orbChatInput.value = '';
			orbChatHistory.scrollTop = orbChatHistory.scrollHeight;

			// Resposta simulada do Orbe
			setTimeout(() => {
				const orbResponseDiv = document.createElement('div');
				orbResponseDiv.className = 'chat-msg orb-msg';
				
				let resposta = "As minhas runas de IA estão a ser calibradas. O Pedro Santos possui sólida experiência em Engenharia e Desenvolvimento de Software (Java, Dart, Flutter, Python, PHP e C++).";
				
				const queryLower = userQuery.toLowerCase();
				if (queryLower.includes('projeto') || queryLower.includes('projetos')) {
					resposta = "O Pedro desenvolveu projetos como o SDGP (Dimensionamento Solar em Flutter), o Lithology (Logs Geológicos em Java) e o ReserGas (Cálculos de Fluidos de Reservatórios).";
				} else if (queryLower.includes('contato') || queryLower.includes('contacto') || queryLower.includes('email')) {
					resposta = "Podes entrar em contacto diretamente pelo LinkedIn ou GitHub oficial do Pedro Santos!";
				}

				orbResponseDiv.innerHTML = `<span class="chat-sender">[ORBE]:</span> ${resposta}`;
				orbChatHistory.appendChild(orbResponseDiv);
				orbChatHistory.scrollTop = orbChatHistory.scrollHeight;
			}, 700);
		});
	}

	function resetIdleTimer() {
		if (isIdle) {
			isIdle = false;
			container.classList.remove('opacity-40');
			container.classList.add('gbc-idle-float');
		}
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => {
			if (!isHovered) {
				isIdle = true;
				container.classList.add('opacity-40');
				container.classList.remove('gbc-idle-float');
			}
		}, 3200);
	}
	resetIdleTimer();

	function drawPixelCircle(ctx, cx, cy, radius, color, dither = false) {
		ctx.fillStyle = color;
		const r2 = radius * radius;
		for (let y = -radius; y <= radius; y += 2) {
			for (let x = -radius; x <= radius; x += 2) {
				if (x * x + y * y <= r2) {
					if (dither && ((Math.floor((cx + x) / 2) + Math.floor((cy + y) / 2)) % 2 !== 0)) {
						continue;
					}
					ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 2, 2);
				}
			}
		}
	}

	function renderGBC() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const targetPal = PALETTES[targetPaletteKey];
		const colorSpeed = (targetPaletteKey === 'GOLD') ? 0.8 : 0.05;
		currentPalette.c0 = lerpColor(currentPalette.c0, targetPal.c0, colorSpeed);
		currentPalette.c1 = lerpColor(currentPalette.c1, targetPal.c1, colorSpeed);
		currentPalette.c2 = lerpColor(currentPalette.c2, targetPal.c2, colorSpeed);
		currentPalette.c3 = lerpColor(currentPalette.c3, targetPal.c3, colorSpeed);

		const rect = container.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const distToMouse = Math.hypot(mouseX - centerX, mouseY - centerY);

		// --- CONTROLO DO BALÃO DE DIÁLOGO (DESKTOP VS MOBILE) ---
		if (speechBubble && !isBubbleManuallyClosed) {
			if (!isTouchDevice) {
				// Lógica de proximidade para Computador (Desktop)
				if (distToMouse < 220 || isHovered) {
					if (wasFarAway) {
						const randomMsg = orbGreetings[Math.floor(Math.random() * orbGreetings.length)];
						if (speechTextEl) speechTextEl.textContent = randomMsg;
						wasFarAway = false;
					}
					speechBubble.classList.add('ativo');
				} else {
					wasFarAway = true;
					speechBubble.classList.remove('ativo');
				}
			} else {
				// Para Mobile/Tablet: mantém aberto por defeito até o utilizador fechar no X
				speechBubble.classList.add('ativo');
			}
		}

		const angleToMouse = Math.atan2(mouseY - centerY, mouseX - centerX);
		const proximity = Math.max(0, 1 - Math.min(distToMouse / 320, 1));
		const pulseRate = 0.050 + (proximity * 0.015);
		pulsePhase += pulseRate;
		const pulseVal = Math.sin(pulsePhase);

		const maxOffset = 16;
		const targetDist = Math.min(distToMouse / 20, maxOffset);
		const targetCoreX = 80 + Math.cos(angleToMouse) * targetDist;
		const targetCoreY = 80 + Math.sin(angleToMouse) * targetDist;

		coreX += (targetCoreX - coreX) * 0.08;
		coreY += (targetCoreY - coreY) * 0.08;

		const auraRadius = Math.floor(42 + pulseVal * (3 + proximity * 1.5));
		drawPixelCircle(ctx, 80, 80, auraRadius, currentPalette.c2, true);

		drawPixelCircle(ctx, 80, 80, 32, currentPalette.c3, false);
		drawPixelCircle(ctx, 80, 80, 28, currentPalette.c2, true);

		const pxCoreX = Math.floor(coreX);
		const pxCoreY = Math.floor(coreY);
		const coreRadius = Math.floor(9 + pulseVal * (1 + proximity * 1.5));
		drawPixelCircle(ctx, pxCoreX, pxCoreY, 14, currentPalette.c2, false);
		drawPixelCircle(ctx, pxCoreX, pxCoreY, coreRadius, currentPalette.c1, false);
		drawPixelCircle(ctx, pxCoreX - 2, pxCoreY - 2, 4, currentPalette.c0, false);

		if (clickFlareRadius > 0) {
			drawPixelCircle(ctx, 80, 80, Math.floor(clickFlareRadius), currentPalette.c0, true);
			clickFlareRadius += 2.5;
			if (clickFlareRadius > 26) clickFlareRadius = 0;
		}

		for (let i = particles.length - 1; i >= 0; i--) {
			particles[i].update();
			particles[i].draw(ctx, currentPalette);
			if (particles[i].life <= 0) {
				particles.splice(i, 1);
			}
		}

		requestAnimationFrame(renderGBC);
	}

	requestAnimationFrame(renderGBC);
})();