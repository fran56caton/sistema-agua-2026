import React, { useState, useEffect, useMemo, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Droplets,
  QrCode,
  ClipboardList,
  BarChart3,
  Download,
  Trash2,
  User,
  Key,
  Calendar,
  Search,
  LogOut,
  Printer,
  Camera,
  XCircle,
} from "lucide-react";

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyCdQW77mj_V8PhsuAuRmC9GcemhqsigIgA",
  authDomain: "aquacontrol-barrio.firebaseapp.com",
  projectId: "aquacontrol-barrio",
  storageBucket: "aquacontrol-barrio.firebasestorage.app",
  messagingSenderId: "392850372676",
  appId: "1:392850372676:web:a4d3766c3f3411569de411",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

// --- Lista de Vecinos (Datos Iniciales) ---
const INITIAL_USERS = [
  { id: "vecino_01", name: "Dina", color: "#3B82F6" },
  { id: "vecino_02", name: "Suegra de Dina", color: "#10B981" },
  { id: "vecino_03", name: "Japa", color: "#F59E0B" },
  { id: "vecino_04", name: "Russel", color: "#EF4444" },
  { id: "vecino_05", name: "Leoncio", color: "#8B5CF6" },
  { id: "vecino_06", name: "Koki", color: "#EC4899" },
  { id: "vecino_07", name: "Jose", color: "#6366F1" },
  { id: "vecino_08", name: "Imperio", color: "#14B8A6" },
  { id: "vecino_09", name: "Inocente", color: "#F97316" },
];

// --- Hook para cargar scripts externos (HTML5-QRCode) ---
const useScript = (src) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error("Error cargando script de cámara");
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [src]);
  return loaded;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard"); // dashboard, scanner, users, history
  const [notification, setNotification] = useState(null);

  // --- Autenticación y Carga de Datos ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Escuchar cambios en la colección de registros
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "water_logs")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().timestamp?.toDate() || new Date(),
        }));
        // Ordenar por fecha descendente (lo más nuevo primero)
        loadedLogs.sort((a, b) => b.date - a.date);
        setLogs(loadedLogs);
        setLoading(false);
      },
      (error) => {
        console.error("Error obteniendo logs:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Lógica del Negocio ---

  const handleLogUsage = async (vecino) => {
    if (!user) return;

    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "water_logs"),
        {
          userId: user.uid, // Quien registró (el administrador)
          vecinoId: vecino.id,
          vecinoName: vecino.name,
          timestamp: Timestamp.now(),
          month: new Date().toLocaleString("es-ES", { month: "long" }),
          year: new Date().getFullYear(),
        }
      );

      showNotification(`✅ Entrega de llave registrada para: ${vecino.name}`);
    } catch (error) {
      console.error("Error al registrar:", error);
      showNotification(`❌ Error al registrar`);
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const deleteLog = async (logId) => {
    if (!confirm("¿Estás seguro de borrar este registro?")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", appId, "public", "data", "water_logs", logId)
      );
      showNotification("Registro eliminado");
    } catch (e) {
      console.error(e);
    }
  };

  const exportToCSV = () => {
    const headers = ["Fecha", "Hora", "Vecino", "ID Vecino", "Mes", "Año"];
    const csvContent = [
      headers.join(","),
      ...logs.map((log) => {
        const d = log.date;
        return `${d.toLocaleDateString()},${d.toLocaleTimeString()},${
          log.vecinoName
        },${log.vecinoId},${log.month},${log.year}`;
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `registro_agua_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Renderizado de Componentes ---

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-cyan-400 animate-pulse">
        Cargando Sistema AquaControl...
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      {/* Sidebar de Navegación */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-cyan-500 rounded-lg shadow-lg shadow-cyan-500/50">
            <Droplets size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">AquaControl</h1>
            <p className="text-xs text-slate-400">Barrio Seguro</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <MenuButton
            active={view === "dashboard"}
            onClick={() => setView("dashboard")}
            icon={<BarChart3 size={20} />}
            label="Panel General"
          />
          <MenuButton
            active={view === "scanner"}
            onClick={() => setView("scanner")}
            icon={<QrCode size={20} />}
            label="Registrar Uso (QR)"
          />
          <MenuButton
            active={view === "history"}
            onClick={() => setView("history")}
            icon={<ClipboardList size={20} />}
            label="Historial Excel"
          />
          <MenuButton
            active={view === "users"}
            onClick={() => setView("users")}
            icon={<User size={20} />}
            label="Carnets y QR"
          />
        </nav>

        <div className="p-4 bg-slate-800 m-4 rounded-xl border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Total Registros 2026</p>
          <p className="text-2xl font-bold text-cyan-400">{logs.length}</p>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-50 relative">
        {/* Header Móvil / Título */}
        <header className="bg-white p-4 shadow-sm border-b border-slate-200 sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-700 capitalize">
            {view === "dashboard"
              ? "Resumen de Consumo"
              : view === "scanner"
              ? "Terminal de Entrega de Llave"
              : view === "history"
              ? "Base de Datos (Excel)"
              : "Gestión de Vecinos"}
          </h2>
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Calendar size={16} />
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </header>

        {/* Notificación Flotante */}
        {notification && (
          <div className="fixed top-20 right-5 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-bounce flex items-center gap-2">
            <Key size={20} />
            {notification}
          </div>
        )}

        {/* Vistas */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {view === "dashboard" && (
            <DashboardView logs={logs} users={INITIAL_USERS} />
          )}

          {view === "scanner" && (
            <ScannerView
              users={INITIAL_USERS}
              onScan={handleLogUsage}
              logs={logs}
            />
          )}

          {view === "history" && (
            <HistoryView
              logs={logs}
              onDelete={deleteLog}
              onExport={exportToCSV}
            />
          )}

          {view === "users" && <UsersView users={INITIAL_USERS} />}
        </div>
      </main>
    </div>
  );
};

// --- Sub-Componentes ---

const MenuButton = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active
        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/20 font-medium"
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const DashboardView = ({ logs, users }) => {
  // Procesar datos para gráficos
  const stats = useMemo(() => {
    const counts = {};
    users.forEach((u) => (counts[u.name] = 0));
    logs.forEach((l) => {
      if (counts[l.vecinoName] !== undefined) counts[l.vecinoName]++;
    });

    const data = Object.keys(counts).map((key) => ({
      name: key,
      usos: counts[key],
    }));
    data.sort((a, b) => b.usos - a.usos);

    // Datos por mes
    const months = {};
    logs.forEach((l) => {
      const m = l.month || "Desconocido";
      months[m] = (months[m] || 0) + 1;
    });
    const dataMonths = Object.keys(months).map((k) => ({
      name: k,
      total: months[k],
    }));

    return { userRanking: data, monthly: dataMonths, total: logs.length };
  }, [logs, users]);

  const topUser =
    stats.userRanking.length > 0
      ? stats.userRanking[0]
      : { name: "-", usos: 0 };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Aperturas"
          value={stats.total}
          icon={<Droplets />}
          color="bg-blue-500"
        />
        <StatCard
          title="Más Frecuente"
          value={topUser.name}
          subValue={`${topUser.usos} veces`}
          icon={<User />}
          color="bg-emerald-500"
        />
        <StatCard
          title="Mes Actual"
          value={new Date().toLocaleString("es-ES", { month: "long" })}
          icon={<Calendar />}
          color="bg-purple-500"
        />
      </div>

      {/* Gráfico Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-slate-700">
            Uso por Vecino
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.userRanking}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar dataKey="usos" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold mb-4 text-slate-700">
            Distribución de Uso
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.userRanking}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="usos"
                >
                  {stats.userRanking.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        users.find((u) => u.name === entry.name)?.color ||
                        "#ccc"
                      }
                    />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ fontSize: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subValue, icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div
      className={`p-4 rounded-xl ${color} text-white shadow-lg shadow-blue-500/20`}
    >
      {React.cloneElement(icon, { size: 28 })}
    </div>
    <div>
      <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">
        {title}
      </p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {subValue && <p className="text-sm text-slate-500">{subValue}</p>}
    </div>
  </div>
);

// --- Componente de Cámara QR (ROBUSTECIDO) ---
const QrScanner = ({ onResult, onCancel }) => {
  // Usamos una versión específica (CDN sólido)
  const scriptLoaded = useScript(
    "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"
  );
  const [scanError, setScanError] = useState(null);
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    // Esperamos a que el script cargue Y que el div 'reader' exista
    if (
      scriptLoaded &&
      !scannerRef.current &&
      document.getElementById("reader")
    ) {
      if (!window.Html5Qrcode) {
        setScanError(
          "La librería de cámara no se cargó correctamente. Reintenta."
        );
        return;
      }

      try {
        // Instancia directa para control granular
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        };

        const onScanSuccess = (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            onResult(data);
          } catch (e) {
            console.warn("QR no es JSON válido, usando como texto plano", e);
            onResult({ id: decodedText });
          }
        };

        const onScanFailure = (err) => {
          // Ignorar errores de frames vacíos
        };

        // Estrategia: Intentar cámara TRASERA (Environment), si falla, intentar CUALQUIERA (User/Default)
        html5QrCode
          .start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
          )
          .then(() => {
            isScanningRef.current = true;
          })
          .catch((errEnv) => {
            console.warn(
              "Fallo cámara trasera, intentando cámara frontal/webcam...",
              errEnv
            );

            // Fallback: Intentar cámara frontal o predeterminada
            html5QrCode
              .start(
                { facingMode: "user" },
                config,
                onScanSuccess,
                onScanFailure
              )
              .then(() => {
                isScanningRef.current = true;
              })
              .catch((errUser) => {
                console.error("Fallo total de cámaras", errUser);
                setScanError(
                  "⚠️ No se pudo activar ninguna cámara. Verifica que hayas dado permiso en el navegador."
                );
              });
          });
      } catch (e) {
        console.error("Error crítico scanner:", e);
        setScanError("No se pudo iniciar el componente de cámara.");
      }
    }

    // Cleanup al desmontar el componente (cerrar modal)
    return () => {
      if (scannerRef.current && isScanningRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current.clear();
            isScanningRef.current = false;
          })
          .catch((err) => console.log("Stop error (puede ignorarse)", err));
      }
    };
  }, [scriptLoaded, onResult]);

  if (!scriptLoaded)
    return (
      <div className="p-8 text-center text-white bg-black/80 rounded-xl">
        Cargando librería de cámara...
      </div>
    );

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-4 w-full max-w-md relative shadow-2xl animate-in fade-in zoom-in duration-200">
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors z-10"
        >
          <XCircle size={32} />
        </button>
        <h3 className="text-center font-bold text-lg mb-4 text-slate-800">
          Escanea el Carnet
        </h3>

        <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px]">
          <div id="reader" className="w-full h-full"></div>
          {!scanError && (
            <div className="absolute inset-0 border-2 border-cyan-500/50 pointer-events-none animate-pulse"></div>
          )}
        </div>

        {scanError ? (
          <div className="text-red-600 text-sm text-center mt-4 bg-red-50 p-3 rounded-lg border border-red-100 flex flex-col gap-2">
            <p className="font-bold">{scanError}</p>
            <p className="text-xs">
              Si estás en Chrome, verifica el icono de candado 🔒 en la barra de
              direcciones y asegúrate de que "Cámara" esté en "Permitir".
            </p>
          </div>
        ) : (
          <p className="text-xs text-center text-slate-400 mt-4">
            Apunta la cámara al código QR del vecino
          </p>
        )}
      </div>
    </div>
  );
};

const ScannerView = ({ users, onScan, logs }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [lastLog, setLastLog] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (logs.length > 0) setLastLog(logs[0]);
  }, [logs]);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQrResult = (data) => {
    if (data && data.id) {
      const matchedUser = users.find((u) => u.id === data.id);
      if (matchedUser) {
        onScan(matchedUser);
        setShowCamera(false);
      } else {
        alert(
          "Usuario no encontrado en la base de datos (ID: " + data.id + ")"
        );
        // Opcional: no cerrar la cámara para permitir reintentar
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Modal Cámara */}
      {showCamera && (
        <QrScanner
          onResult={handleQrResult}
          onCancel={() => setShowCamera(false)}
        />
      )}

      {/* Sección Izquierda: "Escáner" Manual */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-slate-700">
                Registro de Agua
              </h3>
              <p className="text-sm text-slate-400">
                Selecciona o busca un vecino
              </p>
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none">
                <Search
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar vecino..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowCamera(true)}
                className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 shadow-lg shadow-cyan-600/20 whitespace-nowrap font-medium transition-transform active:scale-95"
              >
                <Camera size={18} /> Usar Cámara
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => onScan(u)}
                className="group relative flex flex-col items-center p-6 bg-slate-50 hover:bg-cyan-50 border border-slate-200 hover:border-cyan-300 rounded-xl transition-all active:scale-95"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 shadow-md group-hover:shadow-lg transition-all transform group-hover:scale-110"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.charAt(0)}
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-cyan-700">
                  {u.name}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Entregar Llave
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sección Derecha: Estado del Caño */}
      <div className="space-y-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 mb-4 text-cyan-400">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Estado Actual
            </span>
          </div>

          {lastLog ? (
            <div>
              <p className="text-slate-400 text-sm mb-1">
                Última persona en usar la llave:
              </p>
              <h2 className="text-3xl font-bold mb-2">{lastLog.vecinoName}</h2>
              <p className="text-xs text-slate-500 font-mono">
                {lastLog.date.toLocaleDateString()} -{" "}
                {lastLog.date.toLocaleTimeString()}
              </p>
              <div className="mt-6 pt-6 border-t border-slate-700 flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <Key size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Acción</p>
                  <p className="text-sm font-medium">Llave entregada</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 opacity-50">
              <LogOut size={48} className="mx-auto mb-2" />
              <p>Sin registros aún</p>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
          <h4 className="font-bold text-yellow-800 flex items-center gap-2 mb-2">
            <QrCode size={16} /> Lector QR USB
          </h4>
          <p className="text-xs text-yellow-800">
            Si no usas la cámara y tienes un lector USB físico, haz clic en la
            caja de búsqueda y escanea el carnet. El sistema detectará el texto
            automáticamente.
          </p>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ logs, onDelete, onExport }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
      <div>
        <h3 className="text-lg font-bold text-slate-700">
          Historial Detallado 2026
        </h3>
        <p className="text-sm text-slate-400">
          Registro inmutable de uso del caño comunal.
        </p>
      </div>
      <button
        onClick={onExport}
        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-green-600/20"
      >
        <Download size={18} /> Exportar Excel
      </button>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs">
          <tr>
            <th className="px-6 py-4">Fecha</th>
            <th className="px-6 py-4">Hora</th>
            <th className="px-6 py-4">Vecino</th>
            <th className="px-6 py-4">Mes</th>
            <th className="px-6 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 font-medium text-slate-800">
                {log.date.toLocaleDateString()}
              </td>
              <td className="px-6 py-4 font-mono text-slate-500">
                {log.date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-6 py-4">
                <span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-medium">
                  {log.vecinoName}
                </span>
              </td>
              <td className="px-6 py-4 capitalize">{log.month}</td>
              <td className="px-6 py-4 text-right">
                <button
                  onClick={() => onDelete(log.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors p-2"
                  title="Eliminar registro"
                >
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                No hay registros para mostrar aún.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const UsersView = ({ users }) => {
  const printCards = () => {
    window.print();
  };

  const downloadQR = async (user) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      JSON.stringify({ id: user.id, name: user.name })
    )}&color=334155`;
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `QR_${user.name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error descargando QR", error);
      alert(
        "No se pudo descargar automáticamente. Intenta hacer clic derecho en la imagen y 'Guardar como'."
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h3 className="font-bold text-slate-700">Carnets de Agua Potable</h3>
          <p className="text-sm text-slate-400">
            Imprime estos carnets y repártelos a los vecinos.
          </p>
        </div>
        <button
          onClick={printCards}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
        >
          <Printer size={18} /> Imprimir Todo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4">
        {users.map((u) => (
          <div
            key={u.id}
            className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden flex flex-col break-inside-avoid print:border-slate-800"
          >
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">{u.name}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Residente
                  </p>
                </div>
              </div>
              <Droplets className="text-cyan-500" size={20} />
            </div>
            <div className="p-6 flex flex-col items-center justify-center bg-white relative group">
              {/* Generamos el QR */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                  JSON.stringify({ id: u.id, name: u.name })
                )}&color=334155`}
                alt={`QR de ${u.name}`}
                className="w-32 h-32 mb-2"
              />
              <button
                onClick={() => downloadQR(u)}
                className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg print:hidden"
              >
                <Download size={12} /> Descargar PNG
              </button>
              <p className="text-xs text-slate-400 font-mono text-center mt-2">
                ID: {u.id}
              </p>
            </div>
            <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
              <p className="text-[10px] text-slate-400">
                Caño Comunal 2026 - Uso Personal
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
