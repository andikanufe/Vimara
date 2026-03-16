import { loadPyodide } from "pyodide";

async function main() {
  let pyodide = await loadPyodide();
  await pyodide.loadPackage("matplotlib");
  
  try {
    let result = await pyodide.runPythonAsync(`
import base64
import io
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

user_code = """
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.plot(x, y)
plt.title('Sine Wave')
"""

plt.clf()

local_vars = {}
# Execute user code directly into globals()
exec(user_code, globals())

result = {
    'type': 'image',
    'data': None
}

buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight', transparent=True)
buf.seek(0)
img_b64 = base64.b64encode(buf.read()).decode('utf-8')
plt.close()

result['data'] = img_b64
result
    `);
    
    // Convert out
    let jsOutput;
    if (result && typeof result.toJs === 'function') {
        jsOutput = result.toJs({ dict_converter: Object.fromEntries });
    } else {
        jsOutput = {
           type: result.get('type'),
           data: result.get('data') && result.get('data').length > 50 ? 'long_base64' : result.get('data')
        };
    }
    console.log("Globals scope worked. Image size:", result.get('data').length);
  } catch (err) {
    console.error("Error:\n", err);
  }
}
main();
