
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CyInstance, CyNode, EdgeEditorState, NodeEditorState } from './types';

// Define the child component outside the parent component
const NodeNameInput: React.FC<{ index: number; value: string; onChange: (index: number, value: string) => void }> = ({ index, value, onChange }) => (
  <input
    type="text"
    placeholder={`Вид ${index + 1}`}
    value={value}
    onChange={(e) => onChange(index, e.target.value)}
    className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
  />
);

const App: React.FC = () => {
  const [numNodes, setNumNodes] = useState<number>(5);
  const [nodeNames, setNodeNames] = useState<string[]>(Array.from({ length: 5 }, (_, i) => `Вид ${i + 1}`));
  const [fontSize, setFontSize] = useState<number>(14);
  const [graphRadius, setGraphRadius] = useState<number>(150);
  const [nodeStyles, setNodeStyles] = useState<Record<string, { color: string; size: number }>>({});
  const cyRef = useRef<CyInstance | null>(null);
  const cyContainerRef = useRef<HTMLDivElement>(null);
  const firstNodeRef = useRef<CyNode | null>(null);

  const [edgeEditor, setEdgeEditor] = useState<EdgeEditorState>({
    visible: false,
    edge: null,
    color: '#cccccc',
    thickness: 3,
  });

  const [nodeEditor, setNodeEditor] = useState<NodeEditorState>({
    visible: false,
    node: null,
    color: '#6B7280', // Dark Gray
    size: 40,
  });

  useEffect(() => {
    const newNames = Array.from({ length: numNodes }, (_, i) => nodeNames[i] || `Вид ${i + 1}`);
    setNodeNames(newNames);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numNodes]);

  const handleNodeNameChange = (index: number, value: string) => {
    const newNames = [...nodeNames];
    newNames[index] = value;
    setNodeNames(newNames);
  };

  const updateLabelPositions = useCallback((cy: CyInstance) => {
    if (!cy) return;
    cy.nodes().forEach((node: CyNode) => {
        if (node.data('labelManuallyMoved')) {
            node.style({
                'text-margin-x': `${node.data('labelOffsetX')}px`,
                'text-margin-y': `${node.data('labelOffsetY')}px`,
            });
            return; 
        }

        const angle = node.data('layoutAngle');
        if (angle === undefined) return;

        const currentNodeSize = node.width();
        const margin = 10;
        const distance = (currentNodeSize / 2) + margin + (fontSize / 2);

        const marginX = Math.cos(angle) * distance;
        const marginY = Math.sin(angle) * distance;

        node.style({
            'text-valign': 'center',
            'text-halign': 'center',
            'text-margin-x': `${marginX}px`,
            'text-margin-y': `${marginY}px`,
        });
    });
  }, [fontSize]);

  useEffect(() => {
    if (cyRef.current) {
        cyRef.current.nodes().style({
            'font-size': `${fontSize}px`,
        });
        updateLabelPositions(cyRef.current);
    }
  }, [fontSize, updateLabelPositions]);

  const drawGraph = useCallback(() => {
    if (cyRef.current) {
      cyRef.current.destroy();
    }
    
    const uniqueNames = new Set<string>();
    const nodes = [];
    for (const name of nodeNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;
      if (uniqueNames.has(trimmedName)) {
        alert(`Такой вид уже есть: "${trimmedName}". Названия видов не должны повторяться.`);
        return;
      }
      uniqueNames.add(trimmedName);
      const style = nodeStyles[trimmedName] || { color: '#6B7280', size: 40 };
      nodes.push({ data: { id: trimmedName, ...style } });
    }

    if (nodes.length === 0 || !cyContainerRef.current) {
      return;
    }

    const cy = (window as any).cytoscape({
      container: cyContainerRef.current,
      elements: { nodes },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(id)',
            'color': '#000000',
            'font-weight': 'bold',
            'width': 'data(size)',
            'height': 'data(size)',
            'font-size': `${fontSize}px`,
            'text-outline-color': '#FFFFFF',
            'text-outline-width': 2,
            'transition-property': 'background-color, border-color, border-width, width, height',
            'transition-duration': '0.2s',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#6B7280',
            'target-arrow-color': '#6B7280',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'transition-property': 'line-color, target-arrow-color, width',
            'transition-duration': '0.2s',
          },
        },
        {
          selector: '.selected',
          style: {
            'background-color': '#3B82F6',
            'border-color': '#60A5FA',
            'border-width': 4,
          },
        },
      ],
      layout: {
        name: 'circle',
        radius: graphRadius,
        padding: 50,
      },
      wheelSensitivity: 0.05,
    });

    const layout = cy.layout({ name: 'circle', radius: graphRadius, padding: 50 });

    layout.on('layoutstop', () => {
        const bb = cy.nodes().boundingBox();
        const center = { x: bb.x1 + bb.w / 2, y: bb.y1 + bb.h / 2 };

        cy.nodes().forEach((node: CyNode) => {
            const pos = node.position();
            const angle = Math.atan2(pos.y - center.y, pos.x - center.x);
            node.data('layoutAngle', angle);
        });
        updateLabelPositions(cy);
    });
    
    layout.run();
    
    cy.on('tap', 'node', (evt: any) => {
      setEdgeEditor((prev) => ({ ...prev, visible: false }));
      setNodeEditor((prev) => ({ ...prev, visible: false }));
      const clickedNode = evt.target;
      if (!firstNodeRef.current) {
        firstNodeRef.current = clickedNode;
        firstNodeRef.current.addClass('selected');
      } else {
        if (firstNodeRef.current.id() !== clickedNode.id()) {
          const sourceId = firstNodeRef.current.id();
          const targetId = clickedNode.id();
          if (cy.edges(`[source = "${sourceId}"][target = "${targetId}"]`).empty()) {
            cy.add({ group: 'edges', data: { source: sourceId, target: targetId } });
          }
        }
        firstNodeRef.current.removeClass('selected');
        firstNodeRef.current = null;
      }
    });
    
    cy.on('cxttap', 'node', (evt: any) => { // Right click to edit node
      evt.preventDefault();
      if (firstNodeRef.current) {
        firstNodeRef.current.removeClass('selected');
        firstNodeRef.current = null;
      }
      setEdgeEditor({ visible: false, edge: null, color: '', thickness: 0 });
      const node = evt.target;
      setNodeEditor({
        visible: true,
        node,
        color: node.data('color') || '#6B7280',
        size: node.data('size') || 40,
      });
    });

    cy.on('tap', 'edge', (evt: any) => {
      if (firstNodeRef.current) {
        firstNodeRef.current.removeClass('selected');
        firstNodeRef.current = null;
      }
      setNodeEditor({ visible: false, node: null, color: '', size: 0 });
      const edge = evt.target;
      setEdgeEditor({
        visible: true,
        edge: edge,
        color: edge.style('line-color'),
        thickness: edge.style('width'),
      });
    });

    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        if (firstNodeRef.current) {
          firstNodeRef.current.removeClass('selected');
          firstNodeRef.current = null;
        }
        setEdgeEditor((prev) => ({ ...prev, visible: false }));
        setNodeEditor((prev) => ({ ...prev, visible: false }));
      }
    });

    // --- Draggable Labels Logic ---
    let draggedLabelNode: CyNode | null = null;

    cy.on('mousedown', 'node', (evt: any) => {
        if (evt.originalEvent.altKey) {
            draggedLabelNode = evt.target;
            draggedLabelNode.ungrabify();
        }
    });

    cy.on('mousemove', (evt: any) => {
        if (draggedLabelNode) {
            const node = draggedLabelNode;
            const nodePos = node.position();
            const mousePos = evt.position;

            const offsetX = mousePos.x - nodePos.x;
            const offsetY = mousePos.y - nodePos.y;

            node.data('labelManuallyMoved', true);
            node.data('labelOffsetX', offsetX);
            node.data('labelOffsetY', offsetY);

            node.style({
                'text-margin-x': `${offsetX}px`,
                'text-margin-y': `${offsetY}px`,
            });
        }
    });

    cy.on('mouseup', () => {
        if (draggedLabelNode) {
            draggedLabelNode.grabify();
            draggedLabelNode = null;
        }
    });
    // --- End Draggable Labels Logic ---

    cyRef.current = cy;
  }, [nodeNames, fontSize, updateLabelPositions, nodeStyles, graphRadius]);

  const handleSaveEdge = () => {
    if (edgeEditor.edge) {
      edgeEditor.edge.style({
        'line-color': edgeEditor.color,
        'target-arrow-color': edgeEditor.color,
        'width': edgeEditor.thickness,
      });
      setEdgeEditor({ ...edgeEditor, visible: false, edge: null });
    }
  };

  const handleDeleteEdge = () => {
    if (edgeEditor.edge) {
      edgeEditor.edge.remove();
      setEdgeEditor({ ...edgeEditor, visible: false, edge: null });
    }
  };

  const handleSaveNode = () => {
    if (nodeEditor.node) {
      const { node, color, size } = nodeEditor;
      const nodeId = node.id();
      // Update cytoscape instance for immediate feedback
      node.data({ color, size });
       // Update persistent state for redraws
      setNodeStyles(prev => ({
        ...prev,
        [nodeId]: { color, size },
      }));
      updateLabelPositions(cyRef.current!);
      setNodeEditor({ ...nodeEditor, visible: false, node: null });
    }
  };
  
  const handleSaveAsJpg = () => {
    if (cyRef.current) {
        const jpg64 = cyRef.current.jpg({
            bg: '#FFFFFF',
            full: true,
            quality: 1
        });
        const link = document.createElement('a');
        link.href = jpg64;
        link.download = 'sociogram.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  return (
    <div className="h-screen flex bg-white text-gray-900">
      {/* Left Sidebar */}
      <aside className="w-96 min-w-96 bg-gray-100 p-6 flex flex-col space-y-6 overflow-y-auto border-r border-gray-200">
        <header>
            <h1 className="text-3xl font-bold text-black tracking-tight">
                Рисовалка социограмм
            </h1>
            <p className="text-gray-600 mt-1">
                Создавай и изменяй социограммы.
            </p>
             <p className="text-sm text-gray-500 mt-2">
                Подсказка: удерживайте Alt, чтобы переместить название. <br/>
                Правый клик на виде, чтобы изменить его.
             </p>
        </header>

        {/* General Settings */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div>
                <label htmlFor="num-nodes" className="block text-sm font-medium text-gray-700 mb-2">Количество видов</label>
                <input
                    type="number"
                    id="num-nodes"
                    min="1"
                    max="20"
                    value={numNodes}
                    onChange={(e) => setNumNodes(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                    className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
            </div>
            <div>
                <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 mb-2">Размер шрифта: <span className="font-semibold text-blue-500">{fontSize}px</span></label>
                 <input
                    id="font-size"
                    type="range"
                    min="8"
                    max="40"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
            </div>
            <div>
                <label htmlFor="graph-radius" className="block text-sm font-medium text-gray-700 mb-2">Радиус графа: <span className="font-semibold text-blue-500">{graphRadius}</span></label>
                 <input
                    id="graph-radius"
                    type="range"
                    min="50"
                    max="500"
                    value={graphRadius}
                    onChange={(e) => setGraphRadius(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
            </div>
        </div>
        
        {/* Node Names */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Названия видов</h3>
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: numNodes }).map((_, i) => (
                    <NodeNameInput key={i} index={i} value={nodeNames[i]} onChange={handleNodeNameChange} />
                ))}
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200">
            <button
                onClick={drawGraph}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
                Нарисовать Социограмму
            </button>
            <button
                onClick={handleSaveAsJpg}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-300 ease-in-out"
            >
                Сохранить социограмму
            </button>
        </div>

        {/* Node Editor */}
        {nodeEditor.visible && (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xl font-semibold text-black">Изменить вид</h3>
              <div className="space-y-4">
                  <div>
                      <label htmlFor="node-color" className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                      <input
                          type="color"
                          id="node-color"
                          value={nodeEditor.color}
                          onChange={(e) => setNodeEditor({ ...nodeEditor, color: e.target.value })}
                          className="w-full p-1 h-10 bg-white border border-gray-300 rounded-md cursor-pointer"
                      />
                  </div>
                  <div>
                      <label htmlFor="node-size-editor" className="block text-sm font-medium text-gray-700 mb-1">Размер: <span className="font-semibold text-blue-500">{nodeEditor.size}px</span></label>
                      <input
                          type="range"
                          id="node-size-editor"
                          min="10"
                          max="100"
                          value={nodeEditor.size}
                          onChange={(e) => setNodeEditor({ ...nodeEditor, size: parseInt(e.target.value, 10) })}
                          className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                  </div>
              </div>
              <div className="mt-6 flex justify-end">
                  <button onClick={handleSaveNode} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                      Сохранить
                  </button>
              </div>
          </div>
        )}

        {/* Edge Editor */}
        {edgeEditor.visible && (
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xl font-semibold text-black">Изменить стрелку</h3>
              <div className="space-y-4">
                  <div>
                      <label htmlFor="edge-color" className="block text-sm font-medium text-gray-700 mb-1">Цвет</label>
                      <input
                          type="color"
                          id="edge-color"
                          value={edgeEditor.color}
                          onChange={(e) => setEdgeEditor({ ...edgeEditor, color: e.target.value })}
                          className="w-full p-1 h-10 bg-white border border-gray-300 rounded-md cursor-pointer"
                      />
                  </div>
                  <div>
                      <label htmlFor="edge-thickness" className="block text-sm font-medium text-gray-700 mb-1">Толщина: <span className="font-semibold text-blue-500">{edgeEditor.thickness}</span></label>
                      <input
                          type="range"
                          id="edge-thickness"
                          min="1"
                          max="15"
                          value={edgeEditor.thickness}
                          onChange={(e) => setEdgeEditor({ ...edgeEditor, thickness: parseInt(e.target.value, 10) })}
                          className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                  </div>
              </div>
              <div className="mt-6 flex justify-between space-x-3">
                  <button onClick={handleDeleteEdge} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                      Удалить
                  </button>
                  <button onClick={handleSaveEdge} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                      Сохранить
                  </button>
              </div>
          </div>
        )}
      </aside>

      {/* Main Content - Graph */}
      <main className="flex-grow p-6">
        <div ref={cyContainerRef} className="w-full h-full bg-white rounded-2xl shadow-inner border border-gray-200" />
      </main>
    </div>
  );
};

export default App;
