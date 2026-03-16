import { loadPyodide } from "pyodide";

async function main() {
  let pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  const micropip = pyodide.pyimport("micropip");
  
  try {
    await micropip.install("graphviz");
    
    let result = await pyodide.runPythonAsync(`
import graphviz
# We simulate what PythonGraph does using the imports logic
imports_has_graphviz = True
if imports_has_graphviz:
    mock_code = """
import graphviz
def _mock_action(self, *args, **kwargs):
    pass
if hasattr(graphviz.Digraph, 'render'):
    graphviz.Digraph.render = _mock_action
if hasattr(graphviz.Digraph, 'view'):
    graphviz.Digraph.view = _mock_action
if hasattr(graphviz.Digraph, 'save'):
    graphviz.Digraph.save = _mock_action
if hasattr(graphviz.Graph, 'render'):
    graphviz.Graph.render = _mock_action
if hasattr(graphviz.Graph, 'view'):
    graphviz.Graph.view = _mock_action
"""
    exec(mock_code, globals())

user_code = """
import graphviz
dot = graphviz.Digraph(comment='The Round Table')
dot.node('A', 'King Arthur')
dot.render('test', view=True)
"""
local_vars = {}
exec(user_code, globals(), local_vars)
has_dot = False
for val in local_vars.values():
    if isinstance(val, graphviz.Digraph) or isinstance(val, graphviz.Graph):
        has_dot = True
        break
has_dot
    `);
    console.log("Mock worked, has_dot?", result);
  } catch (err) {
    console.error("Error:\n", err);
  }
}
main();
