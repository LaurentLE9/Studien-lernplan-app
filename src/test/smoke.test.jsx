import { render, screen } from "@testing-library/react";

function SmokeTestComponent() {
  return <h1>Testumgebung bereit</h1>;
}

describe("Vitest-Testumgebung", () => {
  it("rendert eine React-Komponente in jsdom", () => {
    render(<SmokeTestComponent />);

    expect(screen.getByRole("heading", { name: "Testumgebung bereit" })).toBeInTheDocument();
  });
});
