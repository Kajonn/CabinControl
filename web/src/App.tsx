import { useEffect, useMemo, useState } from "react";

type Room = {
  id: string;
  name: string;
  entity_id: string;
  current_temperature: number;
  setpoint: number;
  hvac_mode: string;
  hvac_action: string | null;
};

type RoomsResponse = {
  rooms: Room[];
  price: {
    current_price: number;
    unit: string;
  };
  price_limit: {
    enabled: boolean | null;
    max_price: number | null;
    min_temp: number | null;
  };
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function App() {
  const [data, setData] = useState<RoomsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minTemp, setMinTemp] = useState(0);
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);

  const loadRooms = async () => {
    try {
      setError(null);
      const response = await fetchJson<RoomsResponse>("/api/rooms");
      setData(response);
      if (response.price_limit.enabled !== null) {
        setPriceEnabled(response.price_limit.enabled);
        setMaxPrice(response.price_limit.max_price ?? 0);
        setMinTemp(response.price_limit.min_temp ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    const interval = setInterval(loadRooms, 30000);
    return () => clearInterval(interval);
  }, []);

  const setRoomSetpoint = async (roomId: string, temperature: number) => {
    setBusyRoom(roomId);
    try {
      await fetchJson(`/api/rooms/${roomId}/setpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature }),
      });
      await loadRooms();
    } finally {
      setBusyRoom(null);
    }
  };

  const setRoomMode = async (roomId: string, mode: "heat" | "off") => {
    setBusyRoom(roomId);
    try {
      await fetchJson(`/api/rooms/${roomId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      await loadRooms();
    } finally {
      setBusyRoom(null);
    }
  };

  const savePriceLimit = async () => {
    setPolicyBusy(true);
    try {
      await fetchJson("/api/settings/price-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: priceEnabled,
          maxPrice,
          minTemp,
        }),
      });
      await loadRooms();
    } finally {
      setPolicyBusy(false);
    }
  };

  const applyPolicy = async () => {
    setPolicyBusy(true);
    try {
      await fetchJson("/api/actions/apply-policy", { method: "POST" });
      await loadRooms();
    } finally {
      setPolicyBusy(false);
    }
  };

  const isOffline = Boolean(error && !loading);
  const priceSummary = useMemo(() => {
    if (!data) return "--";
    return `${data.price.current_price.toFixed(2)} ${data.price.unit}`;
  }, [data]);

  const priceHelpersConfigured = data?.price_limit.enabled !== null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">CabinControl</h1>
            <p className="text-sm text-slate-400">
              Secure remote heating control for Home Assistant
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-800 px-3 py-1">
              Price: <strong>{priceSummary}</strong>
            </span>
            {isOffline && (
              <span className="rounded-full bg-rose-500/20 px-3 py-1 text-rose-200">
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-6">
        {loading && <div className="text-slate-400">Loading room data...</div>}
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-rose-100">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {data?.rooms.map((room) => (
              <div key={room.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{room.name}</h2>
                  <span className="text-xs uppercase text-slate-400">
                    {room.hvac_action ?? "idle"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Current</p>
                    <p className="text-3xl font-semibold">{room.current_temperature.toFixed(1)}°C</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Setpoint</p>
                    <p className="text-3xl font-semibold">{room.setpoint.toFixed(1)}°C</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    className="rounded-full border border-slate-700 px-3 py-1 text-xl"
                    onClick={() => setRoomSetpoint(room.id, Math.max(5, room.setpoint - 0.5))}
                    disabled={busyRoom === room.id}
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    step={0.5}
                    value={room.setpoint}
                    onChange={(event) => setRoomSetpoint(room.id, Number(event.target.value))}
                    className="flex-1 accent-emerald-400"
                    disabled={busyRoom === room.id}
                  />
                  <button
                    className="rounded-full border border-slate-700 px-3 py-1 text-xl"
                    onClick={() => setRoomSetpoint(room.id, Math.min(30, room.setpoint + 0.5))}
                    disabled={busyRoom === room.id}
                  >
                    +
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Mode: {room.hvac_mode}</span>
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      room.hvac_mode === "heat"
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-200"
                    }`}
                    onClick={() =>
                      setRoomMode(room.id, room.hvac_mode === "heat" ? "off" : "heat")
                    }
                    disabled={busyRoom === room.id}
                  >
                    {room.hvac_mode === "heat" ? "Turn Off" : "Turn On"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div>
              <h2 className="text-lg font-semibold">Price limit</h2>
              <p className="text-sm text-slate-400">
                Enforce a minimum temperature even when electricity is expensive.
              </p>
            </div>

            <label className="flex items-center justify-between gap-3">
              <span>Enable price limiting</span>
              <input
                type="checkbox"
                checked={priceEnabled}
                onChange={(event) => setPriceEnabled(event.target.checked)}
                className="h-5 w-5 accent-emerald-400"
                disabled={!priceHelpersConfigured}
              />
            </label>

            <div className="grid gap-3">
              <label className="text-sm text-slate-300">
                Max price (kr/kWh)
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  disabled={!priceHelpersConfigured}
                />
              </label>
              <label className="text-sm text-slate-300">
                Minimum temp (°C)
                <input
                  type="number"
                  value={minTemp}
                  onChange={(event) => setMinTemp(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  disabled={!priceHelpersConfigured}
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <button
                className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-950"
                onClick={savePriceLimit}
                disabled={policyBusy || !priceHelpersConfigured}
              >
                Save price settings
              </button>
              <button
                className="rounded-lg border border-slate-700 px-4 py-2 font-medium"
                onClick={applyPolicy}
                disabled={policyBusy || !priceHelpersConfigured}
              >
                Apply policy now
              </button>
            </div>
            {!priceHelpersConfigured && (
              <p className="text-xs text-slate-400">
                Price helpers are not configured in the backend.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
