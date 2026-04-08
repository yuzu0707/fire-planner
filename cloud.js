(() => {
  const FIREBASE_VERSION = "12.7.0";

  function getConfig() {
    return window.FIRE_APP_CONFIG?.firebaseConfig || {};
  }

  function isFirebaseConfigured(config) {
    const required = ["apiKey", "authDomain", "projectId", "appId"];
    return required.every((key) => typeof config[key] === "string" && config[key].trim() !== "");
  }

  function getAuthEnvironmentError() {
    const protocol = globalThis.location?.protocol;
    if (protocol && !["http:", "https:", "chrome-extension:"].includes(protocol)) {
      return "当前页面是通过 file:// 打开的。Google 登录必须在 http:// 或 https:// 环境下运行。请先执行 node scripts/dev-server.mjs，再用 http://localhost:8080 打开页面。";
    }

    try {
      const key = "__fire_auth_probe__";
      globalThis.localStorage?.setItem(key, "1");
      globalThis.localStorage?.removeItem(key);
    } catch {
      return "当前环境禁用了浏览器本地存储。Google 登录依赖 Web Storage，请启用后再试。";
    }

    return null;
  }

  const config = getConfig();
  const firebaseGlobal = window.firebase;
  const authEnvironmentError = getAuthEnvironmentError();

  let app = null;
  let auth = null;
  let db = null;
  let readyPromise = Promise.resolve(null);

  if (firebaseGlobal && isFirebaseConfigured(config)) {
    app = firebaseGlobal.apps.length ? firebaseGlobal.app() : firebaseGlobal.initializeApp(config);
    auth = firebaseGlobal.auth();
    db = firebaseGlobal.firestore();
    auth.setPersistence(firebaseGlobal.auth.Auth.Persistence.LOCAL).catch(() => {});

    readyPromise = new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user ? { user } : null);
      });
    });
  }

  function plansRef(userId) {
    return db.collection("users").doc(userId).collection("plans");
  }

  async function getSession() {
    if (!auth) {
      return { session: null, error: null };
    }

    try {
      const session = await readyPromise;
      return { session, error: null };
    } catch (error) {
      return { session: null, error };
    }
  }

  async function signInWithGoogle() {
    if (!auth) {
      return { error: new Error("Firebase 配置还没填，暂时不能启用 Google 登录。") };
    }

    if (authEnvironmentError) {
      return { error: new Error(authEnvironmentError) };
    }

    const provider = new firebaseGlobal.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await auth.signInWithPopup(provider);
      return { error: null };
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        try {
          await auth.signInWithRedirect(provider);
          return { error: null };
        } catch (redirectError) {
          return { error: redirectError };
        }
      }
      return { error };
    }
  }

  async function signOut() {
    if (!auth) {
      return { error: null };
    }

    try {
      await auth.signOut();
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async function listPlans(userId) {
    if (!db || !userId) {
      return { data: [], error: null };
    }

    try {
      const snapshot = await plansRef(userId).orderBy("updatedAt", "desc").get();
      const data = snapshot.docs.map((doc) => {
        const payload = doc.data() || {};
        return {
          id: doc.id,
          ownerId: userId,
          savedAt: payload.updatedAt || payload.createdAt || new Date().toISOString(),
          values: {
            ...(payload.payload || {}),
            planName: payload.name || payload.payload?.planName || "我的 FIRE 方案",
          },
        };
      });

      return { data, error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  async function savePlan(record, userId) {
    if (!db || !userId) {
      return { data: null, error: null };
    }

    const now = new Date().toISOString();
    const docRef = plansRef(userId).doc(record.id);

    try {
      const existing = await docRef.get();
      const createdAt = existing.exists ? existing.data()?.createdAt || now : now;

      await docRef.set({
        name: record.values.planName || "我的 FIRE 方案",
        payload: record.values,
        createdAt,
        updatedAt: now,
      });

      return { data: { id: record.id }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async function deletePlan(id, userId) {
    if (!db || !userId) {
      return { error: null };
    }

    try {
      await plansRef(userId).doc(id).delete();
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  function onAuthChange(callback) {
    if (!auth) {
      return () => {};
    }

    return auth.onAuthStateChanged((user) => {
      callback(user ? { user } : null);
    });
  }

  window.FireCloud = {
    app,
    auth,
    db,
    isConfigured: Boolean(app && auth && db),
    authEnvironmentError,
    firebaseVersion: FIREBASE_VERSION,
    getSession,
    signInWithGoogle,
    signOut,
    listPlans,
    savePlan,
    deletePlan,
    onAuthChange,
  };
})();
