function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function rangeForDates(fromDate, toDate) {
  const from = formatDate(fromDate);
  const to = formatDate(toDate);
  const dayAfterTo = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate() + 1);
  return {
    from,
    to,
    from_at: startOfLocalDay(fromDate),
    to_before: startOfLocalDay(dayAfterTo),
  };
}

export function vitalsDateRange(filter, selectedDate, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return rangeForDates(today, today);
  }
  if (filter === 'yesterday') {
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    return rangeForDates(yesterday, yesterday);
  }
  if (filter === 'last_month') {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    return rangeForDates(firstDay, lastDay);
  }
  if (filter === 'date' && selectedDate) {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return rangeForDates(date, date);
  }
  return { from: null, to: null, from_at: null, to_before: null };
}
