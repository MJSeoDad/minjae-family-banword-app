import { firebaseConfig, APP_ID } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const FINE_PER_USE = 200;
const MEMBERS = [
  { id: "mom", name: "엄마" },
  { id: "dad", name: "아빠" },
  { id: "minjae", name: "민재" }
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatWon = (amount) => `${Number(amount || 0).toLocaleString("ko-KR")}원`;
const currentMonth = () => new Date().toISOString().slice(0, 7);

const state = {
  db: null,
  auth: null,
  month: currentMonth(),
  settings: null,
  words: [],
  stats: {},
  payments: [],
  adminUid: null,
  isAdmin: false,
  unsubscribers: []
};

const els = {
  mainWord: $("#mainWord"),
  mainWordSub: $("#mainWordSub"),
  monthTotal: $("#monthTotal"),
  setupWarning: $("#setupWarning"),
  monthInput: $("#monthInput"),
  adminButton: $("#adminButton"),
  wordForm: $("#wordForm"),
  wordInput: $("#wordInput"),
  wordList: $("#wordList"),
  wordCount: $("#wordCount"),
  monthlySummary: $("#monthlySummary"),
  paymentList: $("#paymentList"),
  paymentCount: $("#paymentCount"),
  toast: $("#toast")
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.add("hidden"), 3800);
}

function isConfigReady() {
  return firebaseConfig?.apiKey && !firebaseConfig.apiKey.includes("YOUR_");
}

function appDoc(...segments) {
  return doc(state.db, "apps", APP_ID, ...segments);
}

function appCollection(...segments) {
  return collection(state.db, "apps", APP_ID, ...segments);
}

function activeWord() {
  const currentId = state.settings?.currentWordId;
  return state.words.find((word) => word.id === currentId) || state.words[0];
}

function memberStat(memberId) {
  return state.stats[memberId] || { count: 0, unpaidFine: 0 };
}

function render() {
  document.body.classList.toggle("is-admin", state.isAdmin);
  els.adminButton.textContent = state.isAdmin
    ? "관리자 연결됨"
    : state.adminUid
      ? "관리자 권한 확인"
      : "관리자 세션 연결";

  const word = activeWord();
  els.mainWord.textContent = word?.text || "아직 금지어가 없습니다";
  els.mainWordSub.textContent = word
    ? `이번 달 대표 금지어 · 1회당 ${formatWon(FINE_PER_USE)}`
    : "관리자 기기에서 금지어를 추가해 주세요";

  let monthTotal = 0;
  MEMBERS.forEach((member) => {
    const stat = memberStat(member.id);
    monthTotal += stat.unpaidFine || 0;
    $(`[data-count="${member.id}"]`).textContent = stat.count || 0;
    $(`[data-fine="${member.id}"]`).textContent = formatWon(stat.unpaidFine || 0);
  });
  els.monthTotal.textContent = formatWon(monthTotal);

  els.wordCount.textContent = `${state.words.length}개`;
  els.wordList.innerHTML = state.words.length
    ? state.words
        .map(
          (wordItem) => `
            <li class="word-item ${wordItem.id === word?.id ? "current" : ""}">
              <span>${escapeHtml(wordItem.text)}</span>
              <button class="master-only" data-delete-word="${wordItem.id}" type="button" aria-label="${escapeHtml(
                wordItem.text
              )} 삭제">×</button>
            </li>
          `
        )
        .join("")
    : `<li class="word-item"><span>등록된 금지어가 없습니다</span></li>`;

  els.monthlySummary.innerHTML = MEMBERS.map((member) => {
    const stat = memberStat(member.id);
    return `
      <div class="summary-item">
        <div>
          <strong>${member.name}</strong>
          <span>${stat.count || 0}회 사용</span>
        </div>
        <strong>${formatWon(stat.unpaidFine || 0)}</strong>
      </div>
    `;
  }).join("");

  els.paymentCount.textContent = `${state.payments.length}건`;
  els.paymentList.innerHTML = state.payments.length
    ? state.payments
        .map((payment) => {
          const member = MEMBERS.find((item) => item.id === payment.memberId);
          return `
            <div class="payment-item">
              <div>
                <strong>${member?.name || payment.memberName || "가족"}</strong>
                <span>${formatDate(payment.paidAt)} · ${payment.count || 0}회 정산</span>
              </div>
              <strong>${formatWon(payment.amount || 0)}</strong>
            </div>
          `;
        })
        .join("")
    : `<div class="payment-item"><span>아직 납부 이력이 없습니다</span></div>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function stopMonthListeners() {
  state.unsubscribers.forEach((unsubscribe) => unsubscribe());
  state.unsubscribers = [];
}

function startListeners() {
  stopMonthListeners();

  state.unsubscribers.push(
    onSnapshot(appDoc("settings", "main"), (snapshot) => {
      state.settings = snapshot.exists() ? snapshot.data() : {};
      render();
    })
  );

  state.unsubscribers.push(
    onSnapshot(query(appCollection("words"), orderBy("createdAt", "asc")), (snapshot) => {
      state.words = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      render();
    })
  );

  state.unsubscribers.push(
    onSnapshot(appCollection("months", state.month, "stats"), (snapshot) => {
      state.stats = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()]));
      render();
    })
  );

  state.unsubscribers.push(
    onSnapshot(
      query(appCollection("months", state.month, "payments"), orderBy("paidAt", "desc")),
      (snapshot) => {
        state.payments = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        render();
      }
    )
  );
}

async function ensureAdmin() {
  if (!state.adminUid) {
    const credential = await signInAnonymously(state.auth);
    state.adminUid = credential.user.uid;
  }

  const adminSnapshot = await getDoc(appDoc("admins", state.adminUid));
  state.isAdmin = adminSnapshot.exists();
  render();

  if (state.isAdmin) {
    showToast("이 기기는 관리자 권한으로 연결되어 있습니다.");
    await seedInitialData();
  } else {
    showToast(`관리자 UID: ${state.adminUid} · README 안내대로 Firebase에 등록해 주세요.`);
  }
}

async function seedInitialData() {
  if (!state.isAdmin) return;

  const settingsSnapshot = await getDoc(appDoc("settings", "main"));
  const wordsSnapshot = await getDoc(appDoc("words", "default"));

  if (!wordsSnapshot.exists()) {
    await setDoc(appDoc("words", "default"), {
      text: "잠깐만",
      createdAt: serverTimestamp()
    });
  }

  if (!settingsSnapshot.exists()) {
    await setDoc(appDoc("settings", "main"), {
      currentWordId: "default",
      finePerUse: FINE_PER_USE,
      updatedAt: serverTimestamp()
    });
  }
}

async function addWord(event) {
  event.preventDefault();
  requireAdmin();
  const text = els.wordInput.value.trim();
  if (!text) return;

  const wordRef = await addDoc(appCollection("words"), {
    text,
    createdAt: serverTimestamp()
  });

  if (!activeWord()) {
    await setDoc(
      appDoc("settings", "main"),
      { currentWordId: wordRef.id, finePerUse: FINE_PER_USE, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  els.wordInput.value = "";
  showToast("금지어가 추가되었습니다.");
}

async function deleteWord(wordId) {
  requireAdmin();
  const deletingCurrent = activeWord()?.id === wordId;
  await deleteDoc(appDoc("words", wordId));

  if (deletingCurrent) {
    const nextWord = state.words.find((word) => word.id !== wordId);
    await setDoc(
      appDoc("settings", "main"),
      { currentWordId: nextWord?.id || null, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  showToast("금지어가 삭제되었습니다.");
}

async function changeCount(memberId, delta) {
  requireAdmin();
  const statRef = appDoc("months", state.month, "stats", memberId);

  await runTransaction(state.db, async (transaction) => {
    const snapshot = await transaction.get(statRef);
    const current = snapshot.exists() ? snapshot.data() : { count: 0, unpaidFine: 0 };
    const nextCount = Math.max(0, (current.count || 0) + delta);
    transaction.set(
      statRef,
      {
        memberId,
        count: nextCount,
        unpaidFine: nextCount * FINE_PER_USE,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
}

async function payFine(memberId) {
  requireAdmin();
  const stat = memberStat(memberId);
  if (!stat.count && !stat.unpaidFine) {
    showToast("납부할 벌금이 없습니다.");
    return;
  }

  const member = MEMBERS.find((item) => item.id === memberId);
  await addDoc(appCollection("months", state.month, "payments"), {
    memberId,
    memberName: member?.name || memberId,
    count: stat.count || 0,
    amount: stat.unpaidFine || 0,
    month: state.month,
    paidAt: serverTimestamp()
  });

  await updateDoc(appDoc("months", state.month, "stats", memberId), {
    count: 0,
    unpaidFine: 0,
    updatedAt: serverTimestamp(),
    paidCount: increment(stat.count || 0),
    paidAmount: increment(stat.unpaidFine || 0)
  });

  showToast(`${member?.name || "가족"} 벌금 납부가 기록되었습니다.`);
}

function requireAdmin() {
  if (!state.isAdmin) {
    throw new Error("관리자 기기에서만 변경할 수 있습니다.");
  }
}

function bindEvents() {
  els.monthInput.value = state.month;
  els.monthInput.addEventListener("change", () => {
    state.month = els.monthInput.value || currentMonth();
    startListeners();
  });

  els.adminButton.addEventListener("click", () => {
    ensureAdmin().catch((error) => showToast(error.message));
  });

  els.wordForm.addEventListener("submit", (event) => {
    addWord(event).catch((error) => showToast(error.message));
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    const inc = target.dataset.inc;
    const dec = target.dataset.dec;
    const pay = target.dataset.pay;
    const deleteWordId = target.dataset.deleteWord;

    if (inc) changeCount(inc, 1).catch((error) => showToast(error.message));
    if (dec) changeCount(dec, -1).catch((error) => showToast(error.message));
    if (pay) payFine(pay).catch((error) => showToast(error.message));
    if (deleteWordId) deleteWord(deleteWordId).catch((error) => showToast(error.message));
  });
}

function boot() {
  bindEvents();

  if (!isConfigReady()) {
    els.setupWarning.classList.remove("hidden");
    render();
    return;
  }

  const app = initializeApp(firebaseConfig);
  state.db = getFirestore(app);
  state.auth = getAuth(app);

  onAuthStateChanged(state.auth, async (user) => {
    state.adminUid = user?.uid || null;
    if (user) {
      const adminSnapshot = await getDoc(appDoc("admins", user.uid));
      state.isAdmin = adminSnapshot.exists();
      if (state.isAdmin) await seedInitialData();
    }
    render();
  });

  startListeners();
}

boot();
