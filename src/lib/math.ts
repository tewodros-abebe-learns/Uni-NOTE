import katex from 'katex';
import autoRender from 'katex/contrib/auto-render';
export { katex };
export function renderNoteMath(element: HTMLElement, output: 'htmlAndMathml' | 'mathml' = 'htmlAndMathml') {
  autoRender(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false },
      ...['aligned', 'align', 'cases', 'pmatrix', 'bmatrix', 'vmatrix', 'matrix', 'equation', 'array'].map(env => ({ left: `\\begin{${env}}`, right: `\\end{${env}}`, display: true }))
    ], throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, output,
    errorCallback: () => undefined
  });
}
