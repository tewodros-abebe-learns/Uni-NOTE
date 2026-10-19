import { readLocalValue, writeLocalValue, listLocalKeys } from './lib/localPersistence';
import { Folder, Note } from './firebase';

export const DEMO_FOLDERS: Folder[] = [
  {
    id: 'demo_folder_physics',
    name: 'Quantum Physics',
    parentId: null,
    level: 1,
    createdAt: Date.now() - 3600000 * 24 * 3,
  },
  {
    id: 'demo_folder_math',
    name: 'Linear Algebra & Geometry',
    parentId: null,
    level: 1,
    createdAt: Date.now() - 3600000 * 24 * 2,
  },
  {
    id: 'demo_folder_cs',
    name: 'Algorithms & Networks',
    parentId: null,
    level: 1,
    createdAt: Date.now() - 3600000 * 24 * 1,
  },
];

export const DEMO_NOTES: Note[] = [
  {
    id: 'demo_note_schrodinger',
    folderId: 'demo_folder_physics',
    title: 'Schrödinger Equation & Wave Mechanics',
    createdAt: Date.now() - 3600000 * 24 * 3,
    sections: [
      {
        id: 'sec_quantum_1',
        title: 'Postulates & Wave Dynamics',
        content: `# Fundamental Postulates of Quantum Mechanics

Quantum mechanics provides the mathematical framework for physical systems at atomic and subatomic scales. The state of a physical system is completely specified by a state vector or wave function $\\Psi(\\mathbf{r}, t)$ in a complex Hilbert space $\\mathcal{H}$.

> "Those who are not shocked when they first come across quantum theory cannot possibly have understood it." — *Niels Bohr*

### 1. The Time-Dependent Schrödinger Equation (TDSE)
The fundamental dynamical equation governing the temporal evolution of the wave state is:

$$i\\hbar \\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r}, t) = \\hat{H}\\Psi(\\mathbf{r}, t)$$

Where the Hamiltonian operator $\\hat{H}$ in standard 3-dimensional Cartesian coordinates is:

$$\\hat{H} = -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r}, t)$$

Expanding the Laplacian operator $\\nabla^2 = \\frac{\\partial^2}{\\partial x^2} + \\frac{\\partial^2}{\\partial y^2} + \\frac{\\partial^2}{\\partial z^2}$:

$$i\\hbar \\frac{\\partial \\Psi}{\\partial t} = -\\frac{\\hbar^2}{2m}\\left(\\frac{\\partial^2 \\Psi}{\\partial x^2} + \\frac{\\partial^2 \\Psi}{\\partial y^2} + \\frac{\\partial^2 \\Psi}{\\partial z^2}\\right) + V(\\mathbf{r})\\Psi$$

### 2. Probability Density & The Born Rule
The physical probability of observing the quantum particle inside an infinitesimal volume element $d^3\\mathbf{r}$ is:

$$P(\\mathbf{r}, t) = |\\Psi(\\mathbf{r}, t)|^2 = \\Psi^*(\\mathbf{r}, t)\\Psi(\\mathbf{r}, t)$$

With the global normalization invariant:

$$\\int_{-\\infty}^{\\infty} |\\Psi(\\mathbf{r}, t)|^2 \\, d^3\\mathbf{r} = 1$$

[youtube](https://www.youtube.com/watch?v=kYAdwS5MFjQ) @@center-medium@@

### 3. Expectation Values & Observables
For any observable physical quantity represented by Hermitian operator $\\hat{A}$:

$$\\langle \\hat{A} \\rangle = \\int_{-\\infty}^{\\infty} \\Psi^*(\\mathbf{r}, t) \\hat{A} \\Psi(\\mathbf{r}, t) \\, d^3\\mathbf{r} = \\langle \\Psi | \\hat{A} | \\Psi \\rangle$$
`,
      },
      {
        id: 'sec_quantum_2',
        title: 'Particle in a 1D Box (Infinite Well)',
        content: `# The Particle in a 1D Infinite Potential Well

Consider a quantum particle of mass $m$ confined within a hard-wall one-dimensional box:

$$V(x) = \\begin{cases} 0 & 0 \\le x \\le L \\\\ \\infty & \\text{otherwise} \\end{cases}$$

### Boundary Conditions & Eigenfunctions
Inside the potential box ($0 < x < L$), the time-independent Schrödinger equation simplifies to:

$$-\\frac{\\hbar^2}{2m}\\frac{d^2\\psi(x)}{dx^2} = E\\psi(x)$$

Defining wave vector $k = \\frac{\\sqrt{2mE}}{\\hbar}$:

$$\\frac{d^2\\psi}{dx^2} + k^2\\psi = 0$$

Applying the hard-wall Dirichlet boundary conditions $\\psi(0) = 0$ and $\\psi(L) = 0$, we discover spatial quantization:

$$\\psi_n(x) = \\sqrt{\\frac{2}{L}} \\sin\\left(\\frac{n\\pi x}{L}\\right), \\quad n = 1, 2, 3, \\dots$$

### Quantized Discrete Energy Spectrum

$$E_n = \\frac{n^2\\pi^2\\hbar^2}{2mL^2} = \\frac{n^2 h^2}{8mL^2}$$

| Quantum Level $n$ | Energy Level $E_n$ | Wave Nodes in Box |
| :--- | :--- | :--- |
| $n = 1$ (Ground State) | $E_1 = \\frac{\\pi^2\\hbar^2}{2mL^2}$ | $0$ internal nodes |
| $n = 2$ (First Excited) | $E_2 = 4E_1$ | $1$ central node |
| $n = 3$ (Second Excited) | $E_3 = 9E_1$ | $2$ symmetric nodes |
| $n = 4$ | $E_4 = 16E_1$ | $3$ nodes |

The non-zero ground state energy $E_1 > 0$ is the **zero-point energy**, an inescapable consequence of the Heisenberg uncertainty principle:

$$\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2}$$
`,
      },
    ],
  },
  {
    id: 'demo_note_eigenvalues',
    folderId: 'demo_folder_math',
    title: 'Eigenvalues & Diagonalization',
    createdAt: Date.now() - 3600000 * 24 * 2,
    sections: [
      {
        id: 'sec_math_1',
        title: 'The Characteristic Equation',
        content: `# Spectral Decomposition & Eigenvalues

Let $A \\in \\mathbb{R}^{n \\times n}$ be an $n \\times n$ real square matrix. A non-zero vector $\\mathbf{v} \\neq \\mathbf{0}$ is defined as an **eigenvector** with corresponding **eigenvalue** $\\lambda \\in \\mathbb{C}$ if:

$$A\\mathbf{v} = \\lambda \\mathbf{v}$$

Rewriting as a linear homogenous system:

$$(A - \\lambda I)\\mathbf{v} = \\mathbf{0}$$

Since $\\mathbf{v} \\neq \\mathbf{0}$, the nullspace of $(A - \\lambda I)$ is non-trivial, requiring:

$$\\det(A - \\lambda I) = 0$$

### Worked Step-by-Step Example ($2 \\times 2$)
Consider the linear transformation matrix:

$$A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$$

We calculate the determinant of $(A - \\lambda I)$:

$$\\det\\begin{pmatrix} 4 - \\lambda & 1 \\\\ 2 & 3 - \\lambda \\end{pmatrix} = (4 - \\lambda)(3 - \\lambda) - (1)(2) = 0$$

$$\\lambda^2 - 7\\lambda + 12 - 2 = \\lambda^2 - 7\\lambda + 10 = 0$$

Factoring the characteristic polynomial:

$$(\\lambda - 5)(\\lambda - 2) = 0 \\implies \\lambda_1 = 5, \\quad \\lambda_2 = 2$$

### Eigenvector Solutions
For $\\lambda_1 = 5$:

$$(A - 5I)\\mathbf{v}_1 = \\begin{pmatrix} -1 & 1 \\\\ 2 & -2 \\end{pmatrix}\\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} 0 \\\\ 0 \\end{pmatrix} \\implies -x + y = 0 \\implies \\mathbf{v}_1 = \\begin{pmatrix} 1 \\\\ 1 \\end{pmatrix}$$

For $\\lambda_2 = 2$:

$$(A - 2I)\\mathbf{v}_2 = \\begin{pmatrix} 2 & 1 \\\\ 2 & 1 \\end{pmatrix}\\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} 0 \\\\ 0 \\end{pmatrix} \\implies 2x + y = 0 \\implies \\mathbf{v}_2 = \\begin{pmatrix} 1 \\\\ -2 \\end{pmatrix}$$

Matrix diagonalization factorizes $A = P D P^{-1}$:

$$P = \\begin{pmatrix} 1 & 1 \\\\ 1 & -2 \\end{pmatrix}, \\quad D = \\begin{pmatrix} 5 & 0 \\\\ 0 & 2 \\end{pmatrix}$$
`,
      },
    ],
  },
  {
    id: 'demo_note_graphs',
    folderId: 'demo_folder_cs',
    title: 'Shortest Path: Dijkstra & A*',
    createdAt: Date.now() - 3600000 * 24 * 1,
    sections: [
      {
        id: 'sec_cs_1',
        title: 'Routing Paradigms & Heuristics',
        content: `# Graph Theory: Shortest Path Optimization

Finding optimal routes across weighted directed graphs $G = (V, E)$ is fundamental to routing tables, network packet switching, and autonomous robotic pathfinding.

### Algorithmic Comparison

| Algorithm | Optimality | Time Complexity | Negative Edges? |
| :--- | :--- | :--- | :--- |
| **Dijkstra's** | Guaranteed Optimal | $\\mathcal{O}(|E| + |V| \\log |V|)$ | No (Greedy failure) |
| **A* Search** | Optimal if $h$ is admissible | $\\mathcal{O}(|E| + |V| \\log |V|)$ | No |
| **Bellman-Ford** | Guaranteed Optimal | $\\mathcal{O}(|V| \\cdot |E|)$ | Yes (Detects negative cycles) |
| **Floyd-Warshall** | All-Pairs Matrix | $\\mathcal{O}(|V|^3)$ | Yes |

### The A* Priority Function
At each unvisited node $n$, A* evaluates:

$$f(n) = g(n) + h(n)$$

Where:
- $g(n)$: Exact accumulated edge cost from start node $s$ to $n$.
- $h(n)$: Estimated heuristic cost from $n$ to goal $t$.

A heuristic is **admissible** if it never overestimates the true distance $h^*(n)$:

$$h(n) \\le h^*(n), \\quad \\forall n \\in V$$

And **consistent** (monotonic) if for each transition $n \\to n'$ with edge cost $c(n, n')$:

$$h(n) \\le c(n, n') + h(n')$$
`,
      },
    ],
  },
];

const GUEST_FOLDERS_KEY = 'uninote_guest_folders';
const GUEST_NOTES_KEY = 'uninote_guest_notes';

export const loadGuestFolders = (userId?: string): Folder[] => {
  const key = userId ? `uninote_folders_${userId}` : GUEST_FOLDERS_KEY;
  let items: Folder[] = [];
  let hasStoredValue = false;
  try {
    const raw = readLocalValue(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { items = parsed; hasStoredValue = true; }
    }
  } catch {}

  // Account caches never implicitly absorb guest data. Migration is explicit.
  if (userId) return items;

  if (hasStoredValue) return items;

  try {
    writeLocalValue(GUEST_FOLDERS_KEY, JSON.stringify(DEMO_FOLDERS));
  } catch {}
  return DEMO_FOLDERS;
};

export const saveGuestFolders = (folders: Folder[], userId?: string): boolean => {
  const key = userId ? `uninote_folders_${userId}` : GUEST_FOLDERS_KEY;
  return writeLocalValue(key, JSON.stringify(folders));
};

export const loadGuestNotes = (userId?: string): Note[] => {
  const key = userId ? `uninote_notes_${userId}` : GUEST_NOTES_KEY;
  let items: Note[] = [];
  let hasStoredValue = false;
  try {
    const raw = readLocalValue(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { items = parsed; hasStoredValue = true; }
    }
  } catch {}

  if (userId) return items;

  if (hasStoredValue) return isolateLegacyGuestMirrors(items);

  try {
    writeLocalValue(GUEST_NOTES_KEY, JSON.stringify(DEMO_NOTES));
  } catch {}
  return DEMO_NOTES;
};

export const saveGuestNotes = (notes: Note[], userId?: string): boolean => {
  const key = userId ? `uninote_notes_${userId}` : GUEST_NOTES_KEY;
  return writeLocalValue(key, JSON.stringify(notes));
};

export const resetGuestDemoData = () => {
  try {
    writeLocalValue(GUEST_FOLDERS_KEY, JSON.stringify(DEMO_FOLDERS));
    writeLocalValue(GUEST_NOTES_KEY, JSON.stringify(DEMO_NOTES));
  } catch {}
};

export const isDemoNoteModified = (note: Note): boolean => {
  if (!note.id.startsWith('demo_')) return true;
  const original = DEMO_NOTES.find(d => d.id === note.id);
  if (!original) return true;
  if (note.title !== original.title) return true;
  if (note.sections.length !== original.sections.length) return true;
  for (let i = 0; i < note.sections.length; i++) {
    if (note.sections[i].title !== original.sections[i]?.title) return true;
    if (note.sections[i].content !== original.sections[i]?.content) return true;
  }
  return false;
};

export const isDemoFolderModified = (folder: Folder): boolean => {
  if (!folder.id.startsWith('demo_')) return true;
  const original = DEMO_FOLDERS.find(d => d.id === folder.id);
  if (!original) return true;
  if (folder.name !== original.name) return true;
  if (folder.parentId !== original.parentId) return true;
  return false;
};

/** Older versions mirrored signed-in notes into Guest. Hide known account IDs, retaining a recovery copy. */
function isolateLegacyGuestMirrors(notes: Note[]): Note[] {
  const accountIds = new Set<string>();
  for (const key of listLocalKeys().filter(key => key.startsWith('uninote_notes_'))) {
    try { for (const note of JSON.parse(readLocalValue(key) || '[]')) accountIds.add(note.id); } catch { /* Keep malformed account data untouched. */ }
  }
  const mirrors = notes.filter(note => accountIds.has(note.id));
  if (!mirrors.length) return notes;
  const key = 'uninote_legacy_account_mirrors';
  let archive: Note[] = [];
  try { archive = JSON.parse(readLocalValue(key) || '[]'); } catch { /* Original guest source is untouched until its next explicit save. */ }
  const additions = mirrors.filter(note => !archive.some(saved => JSON.stringify(saved) === JSON.stringify(note)));
  if (additions.length) writeLocalValue(key, JSON.stringify([...archive, ...additions]));
  return notes.filter(note => !accountIds.has(note.id));
}
