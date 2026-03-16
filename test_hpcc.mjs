
import { Graphviz } from "@hpcc-js/wasm";

async function run() {
    const graphviz = await Graphviz.load();
    const dot = `
digraph G {
  node [shape=box]
  B [label=<
    <TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">
      <TR><TD ROWSPAN="2"><I>n</I> = </TD><TD ALIGN="CENTER"><I>l</I> + <I>t</I><BR align="center"/><HR/><I>3</I></TD></TR>
    </TABLE>
  >]
}
`;
    try {
        const svg = graphviz.layout(dot, "svg", "dot");
        console.log("Success with length ALIGN:", svg.length);
    } catch(e) {
        console.error("Error formatting ALIGN:", e.message);
    }
}
run();

