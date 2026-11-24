// data.js — SINH ĐỀ SUDOKU (dùng đề gốc từ SQL Server hoặc sinh cục bộ)
// Trả về: { initialGrid, solutionGrid, blanksCount, givensCount, difficulty }
// initialGrid / solutionGrid là chuỗi 81 ký tự, '0' = ô trống.

const SUDOKU_GIVENS_BY_DIFFICULTY = { EASY: 40, MEDIUM: 30, HARD: 25 };

// Xáo trộn ngẫu nhiên thứ tự các phần tử trong mảng tại chỗ theo thuật toán Fisher-Yates và trả về mảng đó
function sdkShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Sinh bảng đáp án đầy đủ bằng quay lui ngẫu nhiên
function sdkBuildFullSolution() {
  const grid = Array(81).fill(0);

  function canPlace(idx, d) {
    const r = Math.floor(idx / 9), c = idx % 9;
    for (let i = 0; i < 9; i++) {
      if (grid[r * 9 + i] === d || grid[i * 9 + c] === d) return false;
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) {
        if (grid[rr * 9 + cc] === d) return false;
      }
    }
    return true;
  }

  function fill(idx) {
    if (idx === 81) return true;
    for (const d of sdkShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (canPlace(idx, d)) {
        grid[idx] = d;
        if (fill(idx + 1)) return true;
        grid[idx] = 0;
      }
    }
    return false;
  }

  fill(0);
  return grid;
}

// Đếm số nghiệm (dừng khi đạt limit) để đảm bảo đề có nghiệm duy nhất
function sdkCountSolutions(cells, limit = 2) {
  const g = cells.slice();
  let count = 0;

  function candidates(idx) {
    const r = Math.floor(idx / 9), c = idx % 9;
    const used = new Set();
    for (let i = 0; i < 9; i++) {
      used.add(g[r * 9 + i]);
      used.add(g[i * 9 + c]);
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) used.add(g[rr * 9 + cc]);
    }
    const res = [];
    for (let d = 1; d <= 9; d++) if (!used.has(d)) res.push(d);
    return res;
  }

  function solve() {
    if (count >= limit) return;
    // Chọn ô trống có ít ứng viên nhất để cắt nhánh nhanh (MRV)
    let bestIdx = -1, bestCands = null;
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0) {
        const cands = candidates(i);
        if (bestCands === null || cands.length < bestCands.length) {
          bestIdx = i;
          bestCands = cands;
          if (cands.length <= 1) break;
        }
      }
    }
    if (bestIdx === -1) { count++; return; }
    for (const d of bestCands) {
      g[bestIdx] = d;
      solve();
      if (count >= limit) break;
    }
    g[bestIdx] = 0;
  }

  solve();
  return count;
}

// Khoét ô trống từ bảng đáp án, giữ nghiệm duy nhất
function sdkCarvePuzzle(solution, targetGivens) {
  const puzzle = solution.slice();
  const order = sdkShuffle(Array.from({ length: 81 }, (_, i) => i));
  let givens = 81;

  for (const idx of order) {
    if (givens <= targetGivens) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    if (sdkCountSolutions(puzzle, 2) !== 1) {
      puzzle[idx] = backup; // khoét ô này làm đề đa nghiệm -> trả lại
    } else {
      givens--;
    }
  }
  return puzzle;
}

// Biến đổi đề gốc từ DB: hoán vị chữ số 1-9 + xáo hàng/cột trong cùng dải
function sdkTransformDbPuzzle(initialGrid, solutionGrid) {
  const digits = sdkShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rowOrder = [];
  const colOrder = [];
  for (const band of sdkShuffle([0, 1, 2])) {
    for (const r of sdkShuffle([0, 1, 2])) rowOrder.push(band * 3 + r);
  }
  for (const stack of sdkShuffle([0, 1, 2])) {
    for (const c of sdkShuffle([0, 1, 2])) colOrder.push(stack * 3 + c);
  }

  const mapGrid = (str) => {
    let out = '';
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const ch = str[rowOrder[r] * 9 + colOrder[c]];
        out += ch === '0' ? '0' : String(digits[parseInt(ch, 10) - 1]);
      }
    }
    return out;
  };

  return { initialGrid: mapGrid(initialGrid), solutionGrid: mapGrid(solutionGrid) };
}

// Tạo đề Sudoku theo độ khó và trả về chuỗi đề, đáp án kèm số ô trống và ô cho sẵn
function generateSudokuByDifficulty(difficulty = 'EASY', rawInitialGrid = null, rawSolutionGrid = null) {
  const diff = String(difficulty || 'EASY').toUpperCase();
  const targetGivens = SUDOKU_GIVENS_BY_DIFFICULTY[diff] || SUDOKU_GIVENS_BY_DIFFICULTY.EASY;

  let initialGrid, solutionGrid;

  if (rawInitialGrid && rawSolutionGrid && rawInitialGrid.length === 81 && rawSolutionGrid.length === 81) {
    ({ initialGrid, solutionGrid } = sdkTransformDbPuzzle(rawInitialGrid, rawSolutionGrid));
  } else {
    const solution = sdkBuildFullSolution();
    const puzzle = sdkCarvePuzzle(solution, targetGivens);
    initialGrid = puzzle.join('');
    solutionGrid = solution.join('');
  }

  const blanksCount = initialGrid.split('').filter(ch => ch === '0').length;
  return {
    difficulty: diff,
    initialGrid,
    solutionGrid,
    blanksCount,
    givensCount: 81 - blanksCount
  };
}