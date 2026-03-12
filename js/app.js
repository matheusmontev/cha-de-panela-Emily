// =============================================
// APP.JS — Lógica da página principal (convidados)
// =============================================

const presentesRef = db.collection('presentes');
let todosPresentes = [];
let filtroAtual = 'todos';
let presenteSelecionadoId = null;

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', () => {
    carregarMensagem();
    iniciarListenerPresentes();
    configurarFiltros();
    configurarModal();
});

// Carrega a mensagem personalizada do Firestore (editável pelo admin)
function carregarMensagem() {
    db.collection('config').doc('site').get().then(doc => {
        if (doc.exists && doc.data().mensagem) {
            document.getElementById('hero-message').textContent = doc.data().mensagem;
        }
    }).catch(err => console.log('Usando mensagem padrão'));
}

// Listener em tempo real — atualiza a lista automaticamente
function iniciarListenerPresentes() {
    presentesRef.orderBy('ordem', 'asc').onSnapshot(snapshot => {
        todosPresentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarPresentes();
        atualizarProgresso();
    }, error => {
        console.error('Erro ao carregar presentes:', error);
        document.getElementById('gift-grid').innerHTML =
            '<div class="empty-state"><span>😕</span><p>Erro ao carregar os presentes. Tente recarregar a página.</p></div>';
    });
}

// ============ RENDERIZAÇÃO DOS CARDS ============
function renderizarPresentes() {
    const grid = document.getElementById('gift-grid');
    let presentesFiltrados = todosPresentes;

    if (filtroAtual === 'disponiveis') {
        presentesFiltrados = todosPresentes.filter(p => !p.escolhido);
    } else if (filtroAtual === 'escolhidos') {
        presentesFiltrados = todosPresentes.filter(p => p.escolhido);
    }

    if (presentesFiltrados.length === 0) {
        const msgs = {
            todos: 'Nenhum presente cadastrado ainda.',
            disponiveis: 'Todos os presentes já foram escolhidos! 🎉',
            escolhidos: 'Nenhum presente foi escolhido ainda.'
        };
        grid.innerHTML = `<div class="empty-state"><span>📦</span><p>${msgs[filtroAtual]}</p></div>`;
        return;
    }

    grid.innerHTML = presentesFiltrados.map((p, i) => {
        const reservado = p.escolhido;
        return `
            <div class="gift-card ${reservado ? 'reserved' : ''}" 
                 data-id="${p.id}" 
                 style="animation-delay: ${i * 0.05}s"
                 ${!reservado ? `onclick="abrirModal('${p.id}')"` : ''}>
                <div class="card-image">
                    <img src="${p.fotoUrl}" alt="${p.nome}" loading="lazy" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect fill=%22%23fce4ec%22 width=%22200%22 height=%22200%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>🎁</text></svg>'">
                    ${reservado ? `<span class="reserved-badge">${p.nomeConvidado}</span>` : ''}
                </div>
                <div class="card-info">
                    <h3>${p.nome}</h3>
                </div>
            </div>
        `;
    }).join('');
}

// ============ PROGRESSO ============
function atualizarProgresso() {
    const total = todosPresentes.length;
    const escolhidos = todosPresentes.filter(p => p.escolhido).length;
    const porcentagem = total > 0 ? (escolhidos / total) * 100 : 0;

    document.getElementById('progress-text').textContent =
        `${escolhidos} de ${total} presentes escolhidos`;
    document.getElementById('progress-fill').style.width = `${porcentagem}%`;
}

// ============ FILTROS ============
function configurarFiltros() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelector('.filter-btn.active').classList.remove('active');
            btn.classList.add('active');
            filtroAtual = btn.dataset.filter;
            renderizarPresentes();
        });
    });
}

// ============ MODAL ============
function configurarModal() {
    const modal = document.getElementById('modal');
    const btnConfirmar = document.getElementById('btn-confirmar');
    const btnVoltar = document.getElementById('btn-voltar');
    const btnClose = document.getElementById('modal-close');
    const input = document.getElementById('nome-convidado');

    btnClose.addEventListener('click', fecharModal);
    btnVoltar.addEventListener('click', fecharModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) fecharModal();
    });

    btnConfirmar.addEventListener('click', () => {
        const nome = input.value.trim();
        if (!validarNome(nome)) return;
        confirmarPresente(presenteSelecionadoId, nome);
    });

    // Enter no input confirma
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') btnConfirmar.click();
    });

    // Limpa erro ao digitar
    input.addEventListener('input', () => {
        document.getElementById('error-msg').textContent = '';
    });
}

function abrirModal(id) {
    const presente = todosPresentes.find(p => p.id === id);
    if (!presente || presente.escolhido) return;

    presenteSelecionadoId = id;
    document.getElementById('modal-img').src = presente.fotoUrl;
    document.getElementById('modal-nome').textContent = presente.nome;
    document.getElementById('nome-convidado').value = '';
    document.getElementById('error-msg').textContent = '';

    const btnConfirmar = document.getElementById('btn-confirmar');
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML = '🎉 Confirmar Presente';

    document.getElementById('modal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => document.getElementById('nome-convidado').focus(), 300);
}

function fecharModal() {
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = '';
    presenteSelecionadoId = null;
}

function validarNome(nome) {
    const errorEl = document.getElementById('error-msg');
    if (!nome) {
        errorEl.textContent = 'Por favor, digite seu nome.';
        return false;
    }
    if (nome.length < 4) {
        errorEl.textContent = 'O nome deve ter pelo menos 4 caracteres.';
        return false;
    }
    return true;
}

// ============ CONFIRMAR PRESENTE (com transação) ============
async function confirmarPresente(id, nomeConvidado) {
    const btnConfirmar = document.getElementById('btn-confirmar');
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="spinner"></span> Confirmando...';

    try {
        const docRef = presentesRef.doc(id);

        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw new Error('Presente não encontrado.');
            if (doc.data().escolhido) throw new Error('Este presente já foi escolhido por outra pessoa.');

            transaction.update(docRef, {
                escolhido: true,
                nomeConvidado: nomeConvidado,
                dataEscolha: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        fecharModal();
        mostrarToast();
        launchConfetti();

    } catch (error) {
        console.error('Erro ao confirmar presente:', error);
        const errorEl = document.getElementById('error-msg');

        if (error.message.includes('já foi escolhido')) {
            errorEl.textContent = 'Ops! Alguém acabou de escolher esse presente. 😅';
        } else {
            errorEl.textContent = 'Erro ao confirmar. Tente novamente.';
        }

        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '🎉 Confirmar Presente';
    }
}

// ============ TOAST ============
function mostrarToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============ CONFETTI ============
function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const colors = ['#e8a0b4', '#d4a574', '#c9afd6', '#fce4ec', '#f5e6c8', '#c9a96e', '#7ec8a0'];
    const pieces = [];

    for (let i = 0; i < 120; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            sway: Math.random() * 2 - 1,
            angle: Math.random() * Math.PI * 2,
            spin: Math.random() * 0.2 - 0.1
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speed;
            p.x += p.sway * 0.5;
            p.angle += p.spin;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        frame++;
        if (frame < 200) {
            requestAnimationFrame(animate);
        } else {
            canvas.style.display = 'none';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    animate();
}
