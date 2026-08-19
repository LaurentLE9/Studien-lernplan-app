import { fireEvent, screen, waitFor, within } from "@testing-library/react";

export const PLANNER_STORAGE_KEY = "study_planner_app_v3";

export function readStoredPlannerData() {
  const stored = localStorage.getItem(PLANNER_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export async function openNavigationPage(name) {
  const sidebar = await screen.findByRole("complementary");
  const navigation = within(sidebar).getByRole("navigation");
  fireEvent.click(within(navigation).getByRole("button", { name }));
  await screen.findAllByRole("heading", { name, level: 2 });
}

export function openEntryEditor(entryTitle, buttonIndex) {
  const entryHeading = screen.getByRole("heading", { name: entryTitle, level: 3 });
  const card = entryHeading.closest('[data-slot="card"]');
  if (!card) throw new Error(`Keine Karte für ${entryTitle} gefunden`);
  fireEvent.click(within(card).getAllByRole("button")[buttonIndex]);
}

export async function expectStoredTask(taskId, expected) {
  await waitFor(() => {
    const task = readStoredPlannerData()?.tasks?.find((entry) => entry.id === taskId);
    expect(task).toEqual(expect.objectContaining(expected));
  });
}
