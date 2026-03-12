// =============================================
// ADMIN.JS — Lógica do painel da Emily
// =============================================

const SENHA_ADMIN = '959915';
const presentesRef = db.collection('presentes');
let todosPresentes = [];
let editandoId = null;
let confirmCallback = null;

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', () => {
    configurarLogin();
    configurarFormulario();
    configurarMensagem();
    configurarEditModal();
    configurarConfirmModal();
});

// ============ LOGIN ============
function configurarLogin() {
    const btnLogin = document.getElementById('btn-login');
    const senhaInput = document.getElementById('senha-input');
    const loginError = document.getElementById('login-error');

    btnLogin.addEventListener('click', () => tentarLogin());
    senhaInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') tentarLogin();
    });
    senhaInput.addEventListener('input', () => {
        loginError.textContent = '';
    });

    function tentarLogin() {
        const senha = senhaInput.value.trim();
        if (senha === SENHA_ADMIN) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            iniciarListenerPresentes();
            carregarMensagemAdmin();
        } else {
            loginError.textContent = 'Senha incorreta.';
            senhaInput.value = '';
            senhaInput.focus();
        }
    }

    document.getElementById('btn-logout').addEventListener('click', () => {
        document.getElementById('admin-dashboard').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('senha-input').value = '';
    });
}

// ============ LISTENER EM TEMPO REAL ============
function iniciarListenerPresentes() {
    presentesRef.orderBy('ordem', 'asc').onSnapshot(snapshot => {
        todosPresentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderizarListaAdmin();
        atualizarEstatisticas();
    }, error => {
        console.error('Erro ao carregar presentes:', error);
    });
}

// ============ ESTATÍSTICAS ============
function atualizarEstatisticas() {
    const total = todosPresentes.length;
    const escolhidos = todosPresentes.filter(p => p.escolhido).length;
    const disponiveis = total - escolhidos;
    const porcentagem = total > 0 ? (escolhidos / total) * 100 : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-escolhidos').textContent = escolhidos;
    document.getElementById('stat-disponiveis').textContent = disponiveis;
    document.getElementById('admin-progress-text').textContent = `${escolhidos} de ${total} presentes escolhidos`;
    document.getElementById('admin-progress-fill').style.width = `${porcentagem}%`;
}

// ============ RENDERIZAÇÃO DA LISTA ============
function renderizarListaAdmin() {
    const container = document.getElementById('admin-gifts');

    if (todosPresentes.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-light); text-align: center; padding: 30px;">Nenhum presente cadastrado.</p>';
        return;
    }

    container.innerHTML = todosPresentes.map(p => {
        const statusHtml = p.escolhido
            ? `<p><span class="guest-name">🎉 ${p.nomeConvidado}</span></p>`
            : `<p>Disponível</p>`;

        // Só permite remover se não foi escolhido. Se foi escolhido, mostra opção de desbloquear.
        const actionsHtml = p.escolhido
            ? `<button class="btn-small btn-edit" onclick="abrirEditModal('${p.id}')">Editar</button>
               <button class="btn-small btn-unlock" onclick="pedirConfirmacao('Deseja desbloquear este presente? O nome do convidado será removido.', () => desbloquearPresente('${p.id}'))">Desbloquear</button>`
            : `<button class="btn-small btn-edit" onclick="abrirEditModal('${p.id}')">Editar</button>
               <button class="btn-small btn-delete" onclick="pedirConfirmacao('Deseja remover este presente da lista?', () => removerPresente('${p.id}'))">Remover</button>`;

        return `
            <div class="admin-gift-item">
                <img class="admin-gift-thumb" src="${p.fotoUrl}" alt="${p.nome}" 
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 56 56%22><rect fill=%22%23fce4ec%22 width=%2256%22 height=%2256%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2220%22>🎁</text></svg>'">
                <div class="admin-gift-info">
                    <h4>${p.nome}</h4>
                    ${statusHtml}
                </div>
                <div class="admin-gift-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

// ============ ADICIONAR PRESENTE ============
function configurarFormulario() {
    const btnAdd = document.getElementById('btn-add');
    const nomeInput = document.getElementById('novo-nome');
    const fotoInput = document.getElementById('nova-foto');
    const errorEl = document.getElementById('add-error');

    btnAdd.addEventListener('click', async () => {
        const nome = nomeInput.value.trim();
        const fotoUrl = fotoInput.value.trim();
        errorEl.textContent = '';

        if (!nome) { errorEl.textContent = 'Digite o nome do presente.'; return; }
        if (!fotoUrl) { errorEl.textContent = 'Cole a URL da foto.'; return; }

        // Verifica duplicidade de nome
        const duplicado = todosPresentes.find(p => p.nome.toLowerCase() === nome.toLowerCase());
        if (duplicado) { errorEl.textContent = 'Já existe um presente com esse nome.'; return; }

        btnAdd.disabled = true;
        btnAdd.innerHTML = '<span class="spinner"></span>';

        try {
            // Calcula a próxima ordem
            const maxOrdem = todosPresentes.reduce((max, p) => Math.max(max, p.ordem || 0), 0);

            await presentesRef.add({
                nome: nome,
                fotoUrl: fotoUrl,
                escolhido: false,
                nomeConvidado: null,
                dataEscolha: null,
                ordem: maxOrdem + 1,
                criadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });

            nomeInput.value = '';
            fotoInput.value = '';
        } catch (error) {
            console.error('Erro ao adicionar:', error);
            errorEl.textContent = 'Erro ao adicionar. Tente novamente.';
        }

        btnAdd.disabled = false;
        btnAdd.innerHTML = 'Adicionar Presente';
    });
}

// ============ MENSAGEM DE BOAS-VINDAS ============
const MENSAGEM_PADRAO = 'Que alegria ter você aqui! Estou muito feliz em compartilhar esse momento tão especial. Preparei essa lista de presentes com muito carinho — se quiser me presentear, escolha o que falar mais ao seu coração. Agradeço de todo coração pela sua presença e pelo seu carinho!';

function carregarMensagemAdmin() {
    db.collection('config').doc('site').get().then(doc => {
        const textarea = document.getElementById('mensagem-input');
        if (doc.exists && doc.data().mensagem) {
            textarea.value = doc.data().mensagem;
        } else {
            textarea.value = MENSAGEM_PADRAO;
        }
    }).catch(() => {
        document.getElementById('mensagem-input').value = MENSAGEM_PADRAO;
    });
}

function configurarMensagem() {
    const btnSalvar = document.getElementById('btn-salvar-msg');
    const statusEl = document.getElementById('msg-status');

    btnSalvar.addEventListener('click', async () => {
        const mensagem = document.getElementById('mensagem-input').value.trim();
        if (!mensagem) {
            statusEl.textContent = 'A mensagem não pode ficar vazia.';
            return;
        }

        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<span class="spinner"></span>';
        statusEl.textContent = '';

        try {
            await db.collection('config').doc('site').set({ mensagem }, { merge: true });
            statusEl.style.color = 'var(--color-success)';
            statusEl.textContent = '✓ Mensagem salva com sucesso!';
            setTimeout(() => { statusEl.textContent = ''; statusEl.style.color = ''; }, 3000);
        } catch (error) {
            console.error('Erro ao salvar mensagem:', error);
            statusEl.style.color = '';
            statusEl.textContent = 'Erro ao salvar. Tente novamente.';
        }

        btnSalvar.disabled = false;
        btnSalvar.innerHTML = 'Salvar Mensagem';
    });
}

// ============ MODAL DE EDIÇÃO ============
function configurarEditModal() {
    const modal = document.getElementById('edit-modal');
    const btnSave = document.getElementById('btn-save-edit');
    const btnCancel = document.getElementById('btn-cancel-edit');
    const btnClose = document.getElementById('edit-modal-close');

    const fechar = () => {
        modal.classList.remove('active');
        editandoId = null;
    };

    btnClose.addEventListener('click', fechar);
    btnCancel.addEventListener('click', fechar);
    modal.addEventListener('click', e => { if (e.target === modal) fechar(); });

    btnSave.addEventListener('click', async () => {
        if (!editandoId) return;

        const nome = document.getElementById('edit-nome').value.trim();
        const fotoUrl = document.getElementById('edit-foto').value.trim();
        const errorEl = document.getElementById('edit-error');
        errorEl.textContent = '';

        if (!nome) { errorEl.textContent = 'O nome não pode ficar vazio.'; return; }
        if (!fotoUrl) { errorEl.textContent = 'A URL da foto não pode ficar vazia.'; return; }

        // Verifica duplicidade (excluindo o próprio item)
        const duplicado = todosPresentes.find(p => p.id !== editandoId && p.nome.toLowerCase() === nome.toLowerCase());
        if (duplicado) { errorEl.textContent = 'Já existe outro presente com esse nome.'; return; }

        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner"></span>';

        try {
            await presentesRef.doc(editandoId).update({ nome, fotoUrl });
            fechar();
        } catch (error) {
            console.error('Erro ao editar:', error);
            errorEl.textContent = 'Erro ao salvar. Tente novamente.';
        }

        btnSave.disabled = false;
        btnSave.innerHTML = 'Salvar';
    });
}

function abrirEditModal(id) {
    const presente = todosPresentes.find(p => p.id === id);
    if (!presente) return;

    editandoId = id;
    document.getElementById('edit-nome').value = presente.nome;
    document.getElementById('edit-foto').value = presente.fotoUrl;
    document.getElementById('edit-error').textContent = '';
    document.getElementById('edit-modal').classList.add('active');
}

// ============ REMOVER PRESENTE ============
async function removerPresente(id) {
    const presente = todosPresentes.find(p => p.id === id);
    if (!presente) return;
    if (presente.escolhido) return; // Segurança extra: não remove se já foi escolhido

    try {
        await presentesRef.doc(id).delete();
    } catch (error) {
        console.error('Erro ao remover:', error);
        alert('Erro ao remover presente. Tente novamente.');
    }
}

// ============ DESBLOQUEAR PRESENTE ============
async function desbloquearPresente(id) {
    try {
        await presentesRef.doc(id).update({
            escolhido: false,
            nomeConvidado: null,
            dataEscolha: null
        });
    } catch (error) {
        console.error('Erro ao desbloquear:', error);
        alert('Erro ao desbloquear presente. Tente novamente.');
    }
}

// ============ MODAL DE CONFIRMAÇÃO ============
function configurarConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    const btnYes = document.getElementById('btn-confirm-yes');
    const btnNo = document.getElementById('btn-confirm-no');

    btnNo.addEventListener('click', () => {
        modal.classList.remove('active');
        confirmCallback = null;
    });

    btnYes.addEventListener('click', () => {
        modal.classList.remove('active');
        if (confirmCallback) {
            confirmCallback();
            confirmCallback = null;
        }
    });
}

function pedirConfirmacao(mensagem, callback) {
    document.getElementById('confirm-msg').textContent = mensagem;
    confirmCallback = callback;
    document.getElementById('confirm-modal').classList.add('active');
}
