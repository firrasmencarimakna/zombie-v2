// utils/gridUtils.ts
// File utilitas untuk fungsi getGridPosition yang digunakan bersama

export const getGridPosition = (index: number, totalPlayers: number) => {
  const playersPerRow = 100;
  const row = Math.floor(index / playersPerRow);
  const col = index % playersPerRow;
  const spacingX = 100;
  const spacingY = -120;
  const offsetX = 300;
  const offsetY = -30;

  return {
    x: offsetX + col * spacingX,
    y: offsetY + row * spacingY,
  };
};