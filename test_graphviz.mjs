import { loadPyodide } from "pyodide";

async function main() {
  let pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  
  try {
    // Install python graphviz
    await micropip.install("graphviz");
    
    let result = await pyodide.runPythonAsync(`
import graphviz
dot = graphviz.Digraph(comment='The Round Table')
dot.node('A', 'King Arthur')
dot.node('B', 'Sir Bedevere the Wise')
dot.node('L', 'Sir Lancelot the Brave')
dot.edges(['AB', 'AL'])
dot.edge('B', 'L', constraint='false')
# We can't render because subprocess isn't supported, 
# but we can get the dot source string.
dot.source
    `);
    console.log("DotSource:", result);
  } catch (err) {
    console.error("Error:\n", err);
  }
}
main();
