# Import & Export

### Import

Import to ZX Calculator from PyZX:

* Run Python code:
    ```python
    # Create or load any PyZX graph
    # Example:
    import pyzx
    circuit = pyzx.generate.CNOT_HAD_PHASE_circuit(4, 15)  # A random circuit
    g = circuit.to_basic_gates().to_graph()  # Convert to graph

    # Export and save JSON to a file
    with open('zx-graph.pyzx.json', 'w') as f:
        f.write(g.to_json())
    ```
* In [ZX Calculator](https://zx.cduck.me/), check that edit mode is selected
* Drag-and-drop the file `zx-graph.pyzx.json` onto the graph editor
* Or choose `Import > click to upload`

### Export

Export from ZX Calculator to PyZX:

* Create or load any graph in [ZX Calculator](https://zx.cduck.me/)
* Choose `Export > Save`
* Run Python code:
    ```python
    import pyzx

    # Load JSON and import from file
    with open('graph.pyzx.json', 'r') as f:
        g = pyzx.Graph.from_json(f.read())
    ```
