/**
 * Selected actions — what the student actually decided to do.
 *
 * A recommendation is a suggestion. An action is a commitment the student
 * made by choosing it, and the only number worth putting on a dashboard is
 * the one that comes from actions they completed, not advice we generated.
 *
 * Dismissals are kept too, and they matter as much as the selections. If
 * someone turns down the same advice twice, the honest reading is that this
 * is something they value, so we offer to protect it instead of asking again.
 */

export const STATUS = {
  SELECTED: 'selected',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  DISMISSED: 'dismissed',
};

/** Keeps state in memory only. Used by tests and by server-side rendering. */
export function memoryAdapter(initial = { actions: [], dismissals: [] }) {
  let state = structuredClone(initial);
  return {
    load: () => structuredClone(state),
    save: (next) => { state = structuredClone(next); },
  };
}

/**
 * Browser persistence. Deliberately thin — when the backend is ready, swap
 * this for an adapter that talks to the API and nothing else changes.
 */
export function localStorageAdapter(key = 'ledger.savings.actions') {
  const empty = { actions: [], dismissals: [] };
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw ? { ...empty, ...JSON.parse(raw) } : structuredClone(empty);
      } catch {
        return structuredClone(empty);
      }
    },
    save(state) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(state));
      } catch {
        // A full or blocked storage quota should never break the dashboard.
      }
    },
  };
}

export function createActionStore(adapter = memoryAdapter()) {
  let state = adapter.load();

  function commit() {
    adapter.save(state);
  }

  return {
    list() {
      return structuredClone(state.actions);
    },

    get(actionId) {
      return state.actions.find((a) => a.id === actionId) || null;
    },

    isSelected(recommendationId) {
      return state.actions.some(
        (a) => a.recommendationId === recommendationId && a.status !== STATUS.DISMISSED,
      );
    },

    isDismissed(recommendationId) {
      return state.dismissals.some((d) => d.recommendationId === recommendationId);
    },

    /** The student chose to act on a recommendation. */
    select(recommendation) {
      const existing = state.actions.find((a) => a.recommendationId === recommendation.id);
      if (existing && existing.status !== STATUS.DISMISSED) return structuredClone(existing);

      const action = {
        id: `action_${recommendation.id}`,
        recommendationId: recommendation.id,
        title: recommendation.title,
        categoryName: recommendation.categoryName,
        targetMonthlySaving: recommendation.estimatedMonthlySaving || 0,
        offers: (recommendation.offers || []).map((o) => ({
          id: o.id, title: o.title, url: o.url, provider: o.provider,
        })),
        status: STATUS.SELECTED,
        selectedAt: new Date().toISOString(),
        completedAt: null,
        note: '',
      };

      state.actions = [...state.actions.filter((a) => a.recommendationId !== recommendation.id), action];
      state.dismissals = state.dismissals.filter((d) => d.recommendationId !== recommendation.id);
      commit();
      return structuredClone(action);
    },

    setStatus(actionId, status, { note } = {}) {
      const action = state.actions.find((a) => a.id === actionId);
      if (!action) return null;
      action.status = status;
      action.completedAt = status === STATUS.DONE ? new Date().toISOString() : null;
      if (note !== undefined) action.note = note;
      commit();
      return structuredClone(action);
    },

    /**
     * The student said no. We record what it was about so the engine can stop
     * raising it, and so we can offer to protect it if it comes up again.
     */
    dismiss(recommendation, reason = '') {
      state.actions = state.actions.filter((a) => a.recommendationId !== recommendation.id);

      const previous = state.dismissals.find((d) => d.recommendationId === recommendation.id);
      if (previous) {
        previous.count += 1;
        previous.lastDismissedAt = new Date().toISOString();
        if (reason) previous.reason = reason;
      } else {
        state.dismissals.push({
          recommendationId: recommendation.id,
          categoryId: recommendation.categoryId,
          categoryName: recommendation.categoryName,
          title: recommendation.title,
          reason,
          count: 1,
          lastDismissedAt: new Date().toISOString(),
        });
      }
      commit();
      return structuredClone(state.dismissals);
    },

    dismissals() {
      return structuredClone(state.dismissals);
    },

    /**
     * Turned-down advice, read charitably.
     *
     * Saying no twice to the same suggestion is a clear answer. Rather than
     * keep asking, we offer to make it a protected treat so it stops being
     * raised at all.
     */
    suggestTreatsFromDismissals(threshold = 2) {
      return state.dismissals
        .filter((d) => d.count >= threshold && d.categoryId)
        .map((d) => ({
          label: `your ${(d.categoryName || 'spending').toLowerCase()}`,
          match: { categories: [d.categoryId] },
          monthlyCap: null,
          reason: d.reason || 'You have told us more than once that this one matters to you.',
          fromDismissal: d.recommendationId,
        }));
    },

    /** The headline numbers for the dashboard. */
    progress() {
      const live = state.actions.filter((a) => a.status !== STATUS.DISMISSED);
      const done = live.filter((a) => a.status === STATUS.DONE);

      const sum = (list) => Math.round(
        list.reduce((acc, a) => acc + (a.targetMonthlySaving || 0), 0) * 100,
      ) / 100;

      return {
        selectedCount: live.length,
        inProgressCount: live.filter((a) => a.status === STATUS.IN_PROGRESS).length,
        doneCount: done.length,
        targetMonthlySaving: sum(live),
        achievedMonthlySaving: sum(done),
      };
    },
  };
}
