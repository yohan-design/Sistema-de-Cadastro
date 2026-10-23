"use strict";

/* =====================================================
   StudentHub — script.js
   Tudo é salvo apenas no localStorage deste navegador.
   ===================================================== */

/* ---------- Constantes ---------- */
const STORAGE_KEY = "studenthub_alunos";
const THEME_KEY = "studenthub_tema";
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;           // 2 MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_SIDE = 400;                        // a foto é reduzida para economizar espaço

/* ---------- Atalho para buscar elementos ---------- */
const $ = (id) => document.getElementById(id);

/* ---------- Estado da aplicação ---------- */
let students = [];          // lista de alunos
let currentPhoto = "";      // foto do formulário (data URL ou vazio)
let selectedId = null;      // aluno destacado na tabela
let confirmResolver = null; // usado pelo modal de confirmação

/* =====================================================
   ÍCONES (SVG estático, sem dados do usuário)
   ===================================================== */
function svgIcon(paths) {
  return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
         'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + "</svg>";
}

const ICONS = {
  sun: svgIcon('<circle cx="12" cy="12" r="4.5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'),
  moon: svgIcon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  home: svgIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  user: svgIcon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  book: svgIcon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  camera: svgIcon('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
  save: svgIcon('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  edit: svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>')
};

/* =====================================================
   NOTIFICAÇÕES (toasts)
   ===================================================== */
function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  $("toastContainer").appendChild(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* =====================================================
   MODAL DE CONFIRMAÇÃO
   ===================================================== */
function askConfirm(message) {
  $("confirmText").textContent = message;
  $("confirmModal").hidden = false;
  $("confirmNo").focus();
  return new Promise((resolve) => { confirmResolver = resolve; });
}

function closeConfirm(result) {
  $("confirmModal").hidden = true;
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

/* =====================================================
   TEMA CLARO / ESCURO
   ===================================================== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  // No modo escuro mostramos o sol (para voltar ao claro) e vice-versa
  $("themeIcon").innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
}

function loadTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (erro) { /* ignora */ }

  if (saved !== "light" && saved !== "dark") {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    saved = prefersDark ? "dark" : "light";
  }
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (erro) { /* ignora */ }
}

/* =====================================================
   ARMAZENAMENTO (localStorage)
   ===================================================== */
function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (erro) {
    return false; // geralmente: espaço insuficiente
  }
}

function isValidRecord(item) {
  return item !== null &&
         typeof item === "object" &&
         Number.isFinite(Number(item.id)) &&
         typeof item.fullName === "string";
}

function normalizeRecord(item) {
  return {
    id: Number(item.id),
    fullName: String(item.fullName || ""),
    email: String(item.email || ""),
    phone: String(item.phone || ""),
    gender: String(item.gender || ""),
    birthDate: String(item.birthDate || ""),
    cpf: String(item.cpf || ""),
    course: String(item.course || ""),
    classGroup: String(item.classGroup || ""),
    photo: typeof item.photo === "string" ? item.photo : ""
  };
}

// Registros fictícios, usados somente na primeira abertura do sistema
function createExampleStudents() {
  return [
    { id: 1, fullName: "Exemplo - Ana Souza", email: "ana.exemplo@exemplo.com", phone: "(11) 90000-0001",
      gender: "Feminino", birthDate: "2008-03-14", cpf: "529.982.247-25",
      course: "Técnico em Informática", classGroup: "3º Ano", photo: "" },
    { id: 2, fullName: "Exemplo - Bruno Lima", email: "bruno.exemplo@exemplo.com", phone: "(11) 90000-0002",
      gender: "Masculino", birthDate: "2009-07-22", cpf: "111.444.777-35",
      course: "Redes de Computadores", classGroup: "2º Ano", photo: "" },
    { id: 3, fullName: "Exemplo - Carla Mendes", email: "carla.exemplo@exemplo.com", phone: "(11) 90000-0003",
      gender: "Feminino", birthDate: "2010-11-05", cpf: "123.456.789-09",
      course: "Administração", classGroup: "1º Ano", photo: "" }
  ];
}

function loadStudents() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (erro) {
    showToast("O armazenamento local não está disponível neste navegador.", "error");
    return [];
  }

  // Primeira abertura: cria exemplos fictícios
  if (raw === null) {
    const examples = createExampleStudents();
    saveToStorage(examples);
    return examples;
  }

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) { throw new Error("Formato inesperado"); }
    return data.filter(isValidRecord).map(normalizeRecord);
  } catch (erro) {
    // Guarda uma cópia dos dados inválidos e começa com lista vazia
    try { localStorage.setItem(STORAGE_KEY + "_backup_invalido", raw); } catch (e) { /* ignora */ }
    showToast("Os dados salvos estavam inválidos. O sistema foi iniciado com a lista vazia.", "error");
    return [];
  }
}

function getNextId() {
  let maior = 0;
  students.forEach((s) => { if (s.id > maior) { maior = s.id; } });
  return maior + 1;
}

/* =====================================================
   MÁSCARAS (CPF e telefone)
   ===================================================== */
function maskCpf(value) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) { return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9); }
  if (d.length > 6) { return d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6); }
  if (d.length > 3) { return d.slice(0, 3) + "." + d.slice(3); }
  return d;
}

function maskPhone(value) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length > 10) { return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7); }
  if (d.length > 6) { return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6); }
  if (d.length > 2) { return "(" + d.slice(0, 2) + ") " + d.slice(2); }
  if (d.length > 0) { return "(" + d; }
  return "";
}

/* =====================================================
   VALIDAÇÕES
   ===================================================== */
function onlyDigits(text) {
  return text.replace(/\D/g, "");
}

// Validação oficial do CPF (dígitos verificadores)
function isValidCpf(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) { return false; }
  if (/^(\d)\1{10}$/.test(d)) { return false; } // 111.111.111-11 etc.

  for (let posicao = 9; posicao < 11; posicao++) {
    let soma = 0;
    for (let i = 0; i < posicao; i++) {
      soma += Number(d[i]) * (posicao + 1 - i);
    }
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(d[posicao])) { return false; }
  }
  return true;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function getAge(dateText) {
  const birth = new Date(dateText + "T00:00:00");
  if (Number.isNaN(birth.getTime())) { return null; }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) { age--; }
  return { age: age, date: birth, today: today };
}

function readForm() {
  return {
    fullName: $("fullName").value.trim().replace(/\s+/g, " "),
    email: $("email").value.trim().toLowerCase(),
    phone: $("phone").value.trim(),
    gender: $("gender").value,
    birthDate: $("birthDate").value,
    cpf: $("cpf").value.trim(),
    course: $("course").value,
    classGroup: $("classGroup").value
  };
}

function validateForm(data, editingId) {
  const errors = {};

  if (!data.fullName) {
    errors.fullName = "Informe o nome completo.";
  } else if (data.fullName.length < 5 || data.fullName.indexOf(" ") === -1) {
    errors.fullName = "Digite o nome e o sobrenome.";
  }

  if (!data.email) {
    errors.email = "Informe o e-mail.";
  } else if (!isValidEmail(data.email)) {
    errors.email = "E-mail inválido. Exemplo: nome@exemplo.com";
  } else if (students.some((s) => s.id !== editingId && s.email.toLowerCase() === data.email)) {
    errors.email = "Este e-mail já está cadastrado.";
  }

  const phoneDigits = onlyDigits(data.phone);
  if (!data.phone) {
    errors.phone = "Informe o telefone.";
  } else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = "Telefone inválido. Use DDD + número.";
  }

  if (!data.gender) { errors.gender = "Selecione o sexo."; }

  if (!data.birthDate) {
    errors.birthDate = "Informe a data de nascimento.";
  } else {
    const info = getAge(data.birthDate);
    if (!info) {
      errors.birthDate = "Data inválida.";
    } else if (info.date > info.today) {
      errors.birthDate = "A data não pode estar no futuro.";
    } else if (info.age < 5 || info.age > 100) {
      errors.birthDate = "Idade fora do intervalo aceito (5 a 100 anos).";
    }
  }

  if (!data.cpf) {
    errors.cpf = "Informe o CPF.";
  } else if (!isValidCpf(data.cpf)) {
    errors.cpf = "CPF inválido.";
  } else if (students.some((s) => s.id !== editingId && onlyDigits(s.cpf) === onlyDigits(data.cpf))) {
    errors.cpf = "Este CPF já está cadastrado.";
  }

  if (!data.course) { errors.course = "Selecione o curso."; }
  if (!data.classGroup) { errors.classGroup = "Selecione a turma."; }

  return errors;
}

function setFieldError(fieldId, message) {
  const errorSpan = $("error-" + fieldId);
  if (errorSpan) { errorSpan.textContent = message; }
  const input = $(fieldId);
  if (input) { input.classList.toggle("input-invalid", Boolean(message)); }
}

function clearErrors() {
  ["fullName", "email", "phone", "gender", "birthDate", "cpf", "course", "classGroup", "photo"]
    .forEach((id) => setFieldError(id, ""));
}

/* =====================================================
   FOTO DO ALUNO
   ===================================================== */
function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) { return "?"; }
  if (parts.length === 1) { return parts[0][0].toUpperCase(); }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function updatePhotoPreview() {
  const hasPhoto = currentPhoto !== "";
  $("photoImg").hidden = !hasPhoto;
  $("photoPlaceholder").hidden = hasPhoto;
  $("photoPreview").classList.toggle("has-photo", hasPhoto);
  $("btnRemovePhoto").disabled = !hasPhoto;

  if (hasPhoto) {
    $("photoImg").src = currentPhoto;
  } else {
    $("photoImg").removeAttribute("src");
    const name = $("fullName").value;
    $("photoInitials").textContent = getInitials(name);
    $("photoHint").textContent = name.trim() ? "Sem foto: exibindo as iniciais" : "Nenhuma foto selecionada";
  }
}

// Reduz a imagem para no máximo 400 px e converte para JPEG (economiza espaço)
function resizeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // fundo branco para PNGs com transparência
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
}

function handlePhotoChange() {
  const file = $("photoInput").files[0];
  if (!file) { return; }
  setFieldError("photo", "");

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    setFieldError("photo", "Formato inválido. Use JPG, PNG ou WEBP.");
    $("photoInput").value = "";
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    setFieldError("photo", "A imagem ultrapassa 2 MB. Escolha uma menor.");
    $("photoInput").value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    resizeImage(reader.result)
      .then((resized) => { currentPhoto = resized; updatePhotoPreview(); })
      .catch(() => setFieldError("photo", "Não foi possível ler esta imagem."));
  };
  reader.onerror = () => setFieldError("photo", "Erro ao carregar o arquivo.");
  reader.readAsDataURL(file);
  $("photoInput").value = ""; // permite escolher o mesmo arquivo novamente
}

function removePhoto() {
  currentPhoto = "";
  setFieldError("photo", "");
  updatePhotoPreview();
}

/* =====================================================
   MODO DO FORMULÁRIO (novo / edição)
   ===================================================== */
function setFormMode(editingId) {
  const editing = editingId !== null;
  $("formTitle").textContent = editing ? "Editando aluno #" + editingId : "Novo cadastro";
  $("formBadge").textContent = editing ? "Modo de edição" : "Novo aluno";
  $("formBadge").className = "badge " + (editing ? "badge-edit" : "badge-new");
  $("btnSave").textContent = editing ? "Salvar alterações" : "Salvar cadastro";
  $("btnClear").textContent = editing ? "Cancelar edição" : "Limpar campos";
}

function resetForm() {
  $("studentForm").reset();
  $("studentId").value = "";
  currentPhoto = "";
  selectedId = null;
  clearErrors();
  setFormMode(null);
  updatePhotoPreview();
  renderTable();
}

/* =====================================================
   CADASTRO, EDIÇÃO E EXCLUSÃO
   ===================================================== */
function handleSubmit(event) {
  event.preventDefault();
  clearErrors();

  const editingId = $("studentId").value ? Number($("studentId").value) : null;
  const data = readForm();
  const errors = validateForm(data, editingId);
  const fieldIds = Object.keys(errors);

  if (fieldIds.length > 0) {
    fieldIds.forEach((id) => setFieldError(id, errors[id]));
    $(fieldIds[0]).focus();
    showToast("Verifique os campos destacados em vermelho.", "error");
    return;
  }

  let newList;
  let savedId;

  if (editingId !== null) {
    savedId = editingId;
    newList = students.map((s) => {
      return s.id === editingId ? Object.assign({}, s, data, { photo: currentPhoto }) : s;
    });
  } else {
    savedId = getNextId();
    newList = students.concat([Object.assign({ id: savedId }, data, { photo: currentPhoto })]);
  }

  // Só altera a lista em memória se o localStorage aceitar
  if (!saveToStorage(newList)) {
    showToast("Não foi possível salvar: o armazenamento do navegador está cheio. " +
              "Tente uma foto menor ou remova a foto. Os dados já cadastrados foram mantidos.", "error");
    return;
  }

  students = newList;
  const wasEditing = editingId !== null;
  resetForm();
  selectedId = savedId; // destaca o aluno salvo
  renderTable();
  updateStats();
  showToast(wasEditing ? "Cadastro atualizado com sucesso." : "Aluno cadastrado com sucesso.", "success");
}

function startEdit(id) {
  const student = students.find((s) => s.id === id);
  if (!student) { return; }

  clearErrors();
  $("studentId").value = String(student.id);
  $("fullName").value = student.fullName;
  $("email").value = student.email;
  $("phone").value = student.phone;
  $("gender").value = student.gender;
  $("birthDate").value = student.birthDate;
  $("cpf").value = student.cpf;
  $("course").value = student.course;
  $("classGroup").value = student.classGroup;
  currentPhoto = student.photo; // mantém a foto atual, a menos que seja trocada

  selectedId = id;
  setFormMode(id);
  updatePhotoPreview();
  renderTable();
  $("studentForm").scrollIntoView({ behavior: "smooth", block: "start" });
  $("fullName").focus({ preventScroll: true });
}

async function deleteStudent(id) {
  const student = students.find((s) => s.id === id);
  if (!student) { return; }

  selectedId = id;
  renderTable();

  const confirmed = await askConfirm('Deseja realmente excluir o aluno "' + student.fullName + '"? Esta ação não pode ser desfeita.');
  if (!confirmed) { return; }

  const newList = students.filter((s) => s.id !== id);
  if (!saveToStorage(newList)) {
    showToast("Não foi possível atualizar o armazenamento. O aluno não foi excluído.", "error");
    return;
  }

  students = newList;
  if ($("studentId").value === String(id)) { resetForm(); }
  if (selectedId === id) { selectedId = null; }
  renderTable();
  updateStats();
  showToast("Aluno excluído com sucesso.", "success");
}

/* =====================================================
   TABELA, BUSCA E ESTATÍSTICAS
   ===================================================== */
function normalizeText(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getFilteredStudents() {
  const term = normalizeText($("searchInput").value.trim());
  if (!term) { return students; }
  return students.filter((s) => {
    return normalizeText(s.fullName).includes(term) ||
           normalizeText(s.email).includes(term) ||
           normalizeText(s.course).includes(term);
  });
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function createThumb(student) {
  if (student.photo) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = student.photo;
    img.alt = "Foto de " + student.fullName;
    return img;
  }
  const div = document.createElement("div");
  div.className = "thumb thumb-initials";
  div.textContent = getInitials(student.fullName);
  return div;
}

function createRow(student) {
  const tr = document.createElement("tr");
  if (student.id === selectedId) { tr.classList.add("selected-row"); }

  tr.addEventListener("click", () => {
    selectedId = student.id;
    renderTable();
  });

  tr.appendChild(createCell("#" + student.id));

  const nameCell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = "student-cell";
  const nameSpan = document.createElement("span");
  nameSpan.textContent = student.fullName;
  wrapper.appendChild(createThumb(student));
  wrapper.appendChild(nameSpan);
  nameCell.appendChild(wrapper);
  tr.appendChild(nameCell);

  tr.appendChild(createCell(student.email));
  tr.appendChild(createCell(student.phone));
  tr.appendChild(createCell(student.course));
  tr.appendChild(createCell(student.classGroup));

  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-outline btn-small";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", (e) => { e.stopPropagation(); startEdit(student.id); });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger btn-small";
  deleteBtn.textContent = "Excluir";
  deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteStudent(student.id); });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  actionsCell.appendChild(actions);
  tr.appendChild(actionsCell);

  return tr;
}

function renderTable() {
  const list = getFilteredStudents();
  const body = $("tableBody");
  body.textContent = ""; // limpa as linhas antigas

  list.forEach((student) => body.appendChild(createRow(student)));

  const empty = $("emptyMessage");
  if (list.length === 0) {
    empty.hidden = false;
    empty.textContent = students.length === 0
      ? "Nenhum aluno cadastrado ainda. Use o formulário acima para começar."
      : "Nenhum aluno encontrado para a pesquisa.";
  } else {
    empty.hidden = true;
  }

  const total = students.length;
  let texto = total + (total === 1 ? " aluno cadastrado" : " alunos cadastrados");
  if (list.length !== total) { texto += " — exibindo " + list.length; }
  $("tableCount").textContent = texto;
}

function updateStats() {
  const courses = new Set();
  students.forEach((s) => { if (s.course) { courses.add(s.course); } });

  $("statTotal").textContent = String(students.length);
  $("statActive").textContent = String(students.length); // ativos = registros existentes
  $("statCourses").textContent = String(courses.size);
}

/* =====================================================
   GUIA STUDENTHUB (assistente com mensagens predefinidas)
   ===================================================== */
const GUIDE_STEPS = [
  {
    icon: "home",
    title: "Bem-vindo ao StudentHub",
    text: "O StudentHub é um sistema para cadastrar, consultar, editar e excluir alunos de uma escola. " +
          "Nesta versão, os dados ficam salvos apenas neste navegador."
  },
  {
    icon: "user",
    title: "Preenchimento dos dados",
    text: "Informe nome completo, e-mail válido, telefone com DDD, sexo, data de nascimento e CPF com 11 números. " +
          "O sistema confere o CPF e não aceita e-mail ou CPF repetidos. Campos com * são obrigatórios."
  },
  {
    icon: "book",
    title: "Curso e turma",
    text: "Abra a lista de Curso e escolha o curso do estudante. Depois, em Turma, escolha 1º, 2º ou 3º ano. " +
          "Os dois campos são obrigatórios."
  },
  {
    icon: "camera",
    title: "Foto do aluno",
    text: "Clique em \"Escolher foto\" e selecione uma imagem JPG, PNG ou WEBP de até 2 MB. A prévia aparece na hora. " +
          "Para tirar a foto, use \"Remover foto\". Sem foto, o sistema mostra as iniciais do aluno."
  },
  {
    icon: "save",
    title: "Salvar o cadastro",
    text: "Clique em \"Salvar cadastro\". Se algo estiver errado, uma mensagem vermelha mostra o campo a corrigir. " +
          "Quando der certo, o aluno aparece na tabela, destacado. Use a busca para localizar qualquer aluno."
  },
  {
    icon: "edit",
    title: "Editar e excluir",
    text: "Localize o aluno na tabela e use os botões da coluna Ações. \"Editar\" carrega os dados no formulário; " +
          "altere o que precisar e clique em \"Salvar alterações\". \"Excluir\" pede confirmação antes de apagar."
  }
];

let guideIndex = 0;

function renderGuideStep() {
  const total = GUIDE_STEPS.length;
  const step = GUIDE_STEPS[guideIndex];
  const isLast = guideIndex === total - 1;

  $("guideIcon").innerHTML = ICONS[step.icon]; // ícone estático definido neste arquivo
  $("guideTitle").textContent = step.title;
  $("guideText").textContent = step.text;
  $("guideStepLabel").textContent = "Etapa " + (guideIndex + 1) + " de " + total;
  $("guideProgressBar").style.width = ((guideIndex + 1) / total * 100) + "%";

  $("guidePrev").disabled = guideIndex === 0;
  $("guideNext").hidden = isLast;
  $("guideFinish").hidden = !isLast;
}

function openGuide() {
  $("guideBubble").hidden = true;
  $("guidePanel").hidden = false;
  $("guideToggle").setAttribute("aria-expanded", "true");
  renderGuideStep();
}

function closeGuide() {
  $("guidePanel").hidden = true;
  $("guideToggle").setAttribute("aria-expanded", "false");
  $("guideToggle").focus();
}

function toggleGuide() {
  if ($("guidePanel").hidden) { openGuide(); } else { closeGuide(); }
}

function goToNextStep() {
  if (guideIndex < GUIDE_STEPS.length - 1) {
    guideIndex++;
    renderGuideStep();
  }
}

function goToPreviousStep() {
  if (guideIndex > 0) {
    guideIndex--;
    renderGuideStep();
  }
}

function finishGuide() {
  guideIndex = 0;
  closeGuide();
  showToast("Guia concluído. Você pode reabri-lo quando quiser.", "success");
}

/* =====================================================
   EVENTOS E INICIALIZAÇÃO
   ===================================================== */
function setupEvents() {
  $("themeToggle").addEventListener("click", toggleTheme);

  $("studentForm").addEventListener("submit", handleSubmit);
  $("btnClear").addEventListener("click", () => {
    const wasEditing = $("studentId").value !== "";
    resetForm();
    showToast(wasEditing ? "Edição cancelada." : "Campos limpos.", "info");
  });
  $("btnNew").addEventListener("click", () => {
    resetForm();
    $("fullName").focus();
  });

  $("fullName").addEventListener("input", () => { if (!currentPhoto) { updatePhotoPreview(); } });
  $("cpf").addEventListener("input", (e) => { e.target.value = maskCpf(e.target.value); });
  $("phone").addEventListener("input", (e) => { e.target.value = maskPhone(e.target.value); });

  $("btnChoosePhoto").addEventListener("click", () => $("photoInput").click());
  $("photoInput").addEventListener("change", handlePhotoChange);
  $("btnRemovePhoto").addEventListener("click", removePhoto);

  $("searchInput").addEventListener("input", renderTable);

  $("confirmYes").addEventListener("click", () => closeConfirm(true));
  $("confirmNo").addEventListener("click", () => closeConfirm(false));
  $("confirmModal").addEventListener("click", (e) => {
    if (e.target === $("confirmModal")) { closeConfirm(false); }
  });

  $("guideToggle").addEventListener("click", toggleGuide);
  $("guideClose").addEventListener("click", closeGuide);
  $("guidePrev").addEventListener("click", goToPreviousStep);
  $("guideNext").addEventListener("click", goToNextStep);
  $("guideFinish").addEventListener("click", finishGuide);
  $("guideBubbleClose").addEventListener("click", () => { $("guideBubble").hidden = true; });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") { return; }
    if (!$("confirmModal").hidden) { closeConfirm(false); }
    else if (!$("guidePanel").hidden) { closeGuide(); }
  });
}

function init() {
  loadTheme();
  students = loadStudents();
  setupEvents();
  setFormMode(null);
  updatePhotoPreview();
  renderTable();
  updateStats();

  // Mensagem de boas-vindas junto ao botão do assistente
  setTimeout(() => {
    if ($("guidePanel").hidden) { $("guideBubble").hidden = false; }
  }, 900);
}

init();