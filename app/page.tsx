'use client';

import { useEffect, useState, useCallback } from 'react';

type PickupTask = { id: number; location: string; time: string | null; assignee: string | null; address: string | null; status: string };
type LaundryTask = { id: number; total_loads: number; pickup_location: string; due_date: string; claimed_loads: number };
type UserLaundryTask = { id: number; laundry_task_id: number; user_name: string; loads: number; status: string };

const STATUS_LABELS: Record<string, string> = {
  pending: 'ממתין',
  picked_up: 'נאסף',
  laundering: 'בכביסה',
  clean: 'נקי',
  dropped_off: 'הוחזר',
};

const STATUS_ORDER = ['pending', 'picked_up', 'laundering', 'clean', 'dropped_off'];

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function HomePage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [pickupTasks, setPickupTasks] = useState<PickupTask[]>([]);
  const [laundryTasks, setLaundryTasks] = useState<LaundryTask[]>([]);
  const [allTasks, setAllTasks] = useState<UserLaundryTask[]>([]);
  const [claimInputs, setClaimInputs] = useState<Record<number, string>>({});
  const [addressInputs, setAddressInputs] = useState<Record<number, string>>({});

  const fetchAll = useCallback(async (user: string) => {
    const [pt, lt, ut] = await Promise.all([
      fetch('/api/pickup-tasks').then((r) => r.json()),
      fetch('/api/laundry-tasks').then((r) => r.json()),
      fetch('/api/user-laundry-tasks').then((r) => r.json()),
    ]);
    setPickupTasks(pt);
    setLaundryTasks(lt);
    setAllTasks(ut);
    setAddressInputs((prev) => {
      const next: Record<number, string> = { ...prev };
      for (const t of pt) if (!(t.id in next)) next[t.id] = t.address ?? '';
      return next;
    });
  }, []);

  useEffect(() => {
    const saved = getCookie('laundry_user');
    if (saved) {
      setUserName(saved);
      fetchAll(saved);
    }
  }, [fetchAll]);

  function submitName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setCookie('laundry_user', trimmed);
    setUserName(trimmed);
    fetchAll(trimmed);
  }

  async function assignPickup(id: number) {
    await fetch(`/api/pickup-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee: userName }),
    });
    fetchAll(userName!);
  }

  async function unassignPickup(id: number) {
    await fetch(`/api/pickup-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee: null }),
    });
    fetchAll(userName!);
  }

  async function updatePickupAddress(id: number) {
    await fetch(`/api/pickup-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addressInputs[id] || null }),
    });
    fetchAll(userName!);
  }

  async function updatePickupStatus(id: number, status: string) {
    await fetch(`/api/pickup-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchAll(userName!);
  }

  async function claimLoads(taskId: number) {
    const loads = Number(claimInputs[taskId]);
    if (!loads || loads < 1) return;
    const res = await fetch('/api/user-laundry-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ laundry_task_id: taskId, user_name: userName, loads }),
    });
    if (!res.ok) {
      const { error } = await res.json();
      alert(error);
      return;
    }
    setClaimInputs((prev) => ({ ...prev, [taskId]: '' }));
    fetchAll(userName!);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/user-laundry-tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchAll(userName!);
  }

  async function deleteMyTask(id: number) {
    await fetch(`/api/user-laundry-tasks/${id}`, { method: 'DELETE' });
    fetchAll(userName!);
  }

  if (!userName) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-72 mx-4">
          <h2 className="text-xl font-bold mb-4 text-center">מה השם שלך?</h2>
          <input
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base mb-4 text-right"
            placeholder="הכנס שם..."
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitName()}
          />
          <button
            onClick={submitName}
            className="w-full bg-blue-600 text-white rounded-lg py-2 font-semibold text-base active:bg-blue-700"
          >
            המשך
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-gray-500 text-sm">שלום, <span className="font-semibold text-gray-800">{userName}</span></p>

      {/* Pickup tasks */}
      {pickupTasks.length > 0 && <section>
        <h2 className="text-lg font-bold mb-3 border-b pb-1">משימות איסוף</h2>
        <>
          <ul className="space-y-2">
            {pickupTasks.map((t) => {
              const isAssignee = t.assignee === userName;
              return (
                <li key={t.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate"><span className="font-normal">איסוף מ</span>{t.location}</p>
                      {t.time && <p className="text-xs text-gray-500">{t.time}</p>}
                      {t.assignee && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {isAssignee ? 'שלך' : t.assignee}
                        </p>
                      )}
                      {!isAssignee && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          {t.status === 'come_collect' ? 'תבואו לאסוף ממני' : 'עוד לא נאסף'}
                        </p>
                      )}
                      {t.address && !isAssignee && (
                        <p className="text-xs text-gray-500 mt-0.5">{t.address}</p>
                      )}
                    </div>
                    {!t.assignee ? (
                      <button
                        onClick={() => assignPickup(t.id)}
                        className="shrink-0 bg-blue-600 text-white text-sm rounded-lg px-3 py-1.5 active:bg-blue-700"
                      >
                        קח על עצמי
                      </button>
                    ) : isAssignee ? (
                      <button
                        onClick={() => unassignPickup(t.id)}
                        className="shrink-0 bg-gray-200 text-gray-600 text-sm rounded-lg px-3 py-1.5"
                      >
                        ויתור
                      </button>
                    ) : null}
                  </div>
                  {isAssignee && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right"
                          placeholder="כתובת (אופציונלי)"
                          value={addressInputs[t.id] ?? ''}
                          onChange={(e) => setAddressInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                          onBlur={() => updatePickupAddress(t.id)}
                          onKeyDown={(e) => e.key === 'Enter' && updatePickupAddress(t.id)}
                        />
                      </div>
                      <div className="flex gap-2">
                        {(['not_collected', 'come_collect'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => updatePickupStatus(t.id, s)}
                            className={`text-xs rounded-full px-3 py-1 ${
                              t.status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {s === 'come_collect' ? 'תבואו לאסוף ממני' : 'עוד לא נאסף'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      </section>}

      {/* Laundry tasks */}
      <section>
        <h2 className="text-lg font-bold mb-3 border-b pb-1">משימות כביסה</h2>
        {laundryTasks.length === 0 ? (
          <p className="text-gray-400 text-sm">אין משימות כביסה</p>
        ) : (
          <ul className="space-y-2">
            {laundryTasks.map((t) => {
              const available = t.total_loads - t.claimed_loads;
              return (
                <li key={t.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold"><span className="font-normal">איסוף מ</span>{t.pickup_location}</p>
                      <p className="text-gray-600">
                        החיילים צריכים את הכביסה עד <span className="font-semibold">{t.due_date}</span>
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${available > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {available} עומסים פנויים לאיסוף 
                    </span>
                  </div>
                  {available > 0 && (
                    <div className="flex gap-2 mt-1">
                      <input
                        type="number"
                        min={1}
                        max={available}
                        placeholder="כמה עומסים תוכלי לכבס?"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right"
                        value={claimInputs[t.id] ?? ''}
                        onChange={(e) => setClaimInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && claimLoads(t.id)}
                      />
                      <button
                        onClick={() => claimLoads(t.id)}
                        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm active:bg-blue-700"
                      >
                        קח
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* All tasks */}
      <section>
        <h2 className="text-lg font-bold mb-3 border-b pb-1">כביסות שהוקצו</h2>
        {allTasks.length === 0 ? (
          <p className="text-gray-400 text-sm">אין משימות עדיין</p>
        ) : (
          <ul className="space-y-2">
            {[...allTasks].sort((a, b) => (b.user_name === userName ? 1 : 0) - (a.user_name === userName ? 1 : 0)).map((t) => {
              const lt = laundryTasks.find((l) => l.id === t.laundry_task_id);
              const ismine = t.user_name === userName;
              return (
                <li key={t.id} className={`rounded-xl shadow-sm p-4 ${ismine ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">
                        {t.loads} עומסים · <span className={ismine ? 'text-blue-600' : 'text-gray-500'}>{t.user_name}</span>
                      </p>
                    </div>
                    {ismine && (
                      <button
                        onClick={() => deleteMyTask(t.id)}
                        className="text-gray-300 text-xl leading-none px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {ismine ? (
                    <div className="flex flex-wrap gap-1">
                      {STATUS_ORDER.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(t.id, s)}
                          className={`text-xs rounded-full px-3 py-1 ${
                            t.status === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs rounded-full px-3 py-1 inline-block bg-gray-100 text-gray-500`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
