"""
Writes stand-in-disease-model.onnx: a model the size of a few hundred bytes that takes the
app's 224x224 photo tensor and always answers the same two probabilities, 0.02 and 0.98.
The photo-diagnosis user story serves it in place of the real model, so the phone-first path
can be checked without depending on what a real model makes of a test photo.

    python tests-e2e/fixtures/make_stand_in_model.py
"""
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

PROBABILITIES = np.array([[0.02, 0.98]], dtype=np.float32)

photo = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, 224, 224])
answer = helper.make_tensor_value_info('probabilities', TensorProto.FLOAT, [1, 2])
nodes = [
    # The photo is read (so the input is used), then multiplied away: the answer never depends on it.
    helper.make_node('ReduceMean', ['input'], ['mean'], keepdims=0),
    helper.make_node('Mul', ['mean', 'zero'], ['nothing']),
    helper.make_node('Add', ['nothing', 'fixed'], ['probabilities']),
]
graph = helper.make_graph(
    nodes, 'stand_in_disease_model', [photo], [answer],
    initializer=[numpy_helper.from_array(np.zeros((1, 2), np.float32), 'zero'), numpy_helper.from_array(PROBABILITIES, 'fixed')],
)
model = helper.make_model(graph, opset_imports=[helper.make_opsetid('', 13)], producer_name='ag-extension e2e')
model.ir_version = 8
onnx.checker.check_model(model)
out = Path(__file__).with_name('stand-in-disease-model.onnx')
out.write_bytes(model.SerializeToString())
print(f'wrote {out} ({out.stat().st_size} bytes)')
