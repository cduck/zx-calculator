# ZX Calculator

ZX Calculator is a tool for creating and manipulating graph-like [ZX diagrams](https://zxcalculus.com).

To start, load an example graph, create one in [Edit mode](edit.md), or [import from PyZX](export.md).  Manipulate  a graph in [Rewrite mode](rewrite.md) with automated rewrite rules based on
[ZX-calculus for the working quantum computer scientist](https://arxiv.org/abs/2012.13966).

<div style="text-align: center"><a href="https://zx.cduck.me/#"><button class="el-button el-button--primary is-plain" style="font-size: 2rem; padding: 2rem 3rem 2rem 3rem; margin-bottom: 1rem">Start Editing</button></a></div>

<div>Examples:</div>

* <a href="https://zx.cduck.me/#{%22g%22:%22;b,,,576,,+,48,576,,+,48,576,,+,48,576,,x,240,,240,,+144,48,144,,96,,+240,48,+96,48,96,,96,,96,,@%CF%80,48,,,48,z,144,,144,,96,,+240,48,+96,48,96,,96,,96,,+48,48,192,,240,,48,,@-%CF%80/4,336,,,48,,48,+144,48,@%CF%80/2,432,144,@%CF%80/4,96,,,48,48,48,192,48;_18,_8,_17,_9,_20,_22,h,7_22,n,8_24,_12__8,_13_8,_10_3_15,_10_2_10,_10_11,_10_2_,_10_4_7,_10_4_6,_10_3_11,_10_9_4,_19,_19,_17,_11,_10,2_15,_14,_8,_7,h,31_,n,31_6;%22,%22s%22:[%22Init%22,%22;b,,,576,,+,48,576,,+,48,576,,+,48,576,,x,240,,240,,+144,48,144,,96,,+240,48,+96,48,96,,96,,96,,@%CF%80,48,,,48,z,144,,144,,96,,+240,48,+96,48,96,,96,,96,,+48,48,192,,240,,48,,@-%CF%80/4,336,,,48,,48,+144,48,@%CF%80/2,432,144,@%CF%80/4,96,,,48,48,48,192,48;_18,_8,_17,_9,_20,_22,h,7_22,n,8_24,_12__8,_13_8,_10_3_15,_10_2_10,_10_11,_10_2_,_10_4_7,_10_4_6,_10_3_11,_10_9_4,_19,_19,_17,_11,_10,2_15,_14,_8,_7,h,31_,n,31_6;%22,%22Make%20green%22,%22;b,,,576,,+,48,576,,+,48,576,,+,48,576,,z,144,,96,,48,,96,,96,,+144,48,96,,48,,96,,+96,48,96,,48,,48,,96,,+48,48,48,,96,,48,,48,,96,,96,,48,,@-%CF%80/4,336,,,48,,48,+144,48,@%CF%80,48,,,48,@%CF%80/2,432,144,@%CF%80/4,96,,,48,48,48,192,48;h,_34,_11,_33,_13,n,5_13,_16,h,7_16,n,8_22,h,9__4,n,9_29,h,10__15,_5,n,11_20,h,12__4,n,12_19,h,13_16,__24,__4,_16,_15,_6,n,18_22,h,19__5,n,19_21,h,20_,_6,n,21_12,h,22_6,n,22_11,h,23_,_10,__8,_,_14,_9_4,_,n,29_8,h,35_3,_3;%22,%22Merge%20black%20edges%22,%22;b,,,576,,+,48,576,,+,48,576,,+,48,576,,z,240,,240,,+144,48,96,,48,,96,,+240,48,+48,48,48,,96,,48,,48,,96,,144,,@-%CF%80/4,384,,+336,48,48,48,+144,48,@%CF%80,48,,,48,@%CF%80/2,480,144,@%CF%80/4,144,,+96,48,96,48,144,48;h,_26,_8,_25,_10,n,5_27,_19,h,7_9,n,8_14,h,9_10_4_7,_13_6,__18_,__2,_10_,_9_,_10_7,_,_9_6,__7_6,_,_5_8,_4_4_4,_7,5_3,_3;%22,%22Extract%20non-clifford%22,%22,-144;b,,144,576,,+,48,576,,+,48,576,,+,48,576,,z,72,48,48,,48,,48,,48,,48,,48,,48,,+144,96,96,,144,,96,,+96,48,48,,96,,48,,48,,48,,+204,48,36,,156,,+48,48,48,,48,,48,,48,,48,,48,,48,,144,,@-%CF%80/4,168,,96,,96,,48,,@%CF%80,48,144,,48,@%CF%80/2,480,288,@%CF%80/4,72,,48,,96,,96,;h,_42,_18,_41,_22,n,5_22,_23,h,7_23,n,8_30,h,9_12_25,_7_30,_21_7,_15_21,_12_15,_22_13,_4_22,_13_13,__4_21,__15,__4_2,_25,__22,_,__4,_,_,2__3_2,_,_6_2,_,_,_,_,_,_,_,_8,_7;%22,%22Add%20nodes%20on%20edges%22,%22-48,-144;b,,144,672,,+,48,672,,+,48,672,,+,48,672,,z,120,48,48,,48,,48,,48,,48,,48,,48,,+48,96,144,,96,,144,,96,,96,,+48,48,96,,48,,96,,48,,48,,48,,192,,+48,48,204,,36,,156,,180,,+48,48,48,,48,,48,,48,,48,,48,,48,,48,,144,,48,,@-%CF%80/4,216,,96,,96,,48,,@%CF%80,96,144,,48,@%CF%80/2,528,288,@%CF%80/4,120,,48,,96,,96,;_16,_20,_20,_26,h,5_26,_29,n,7_29,h,8_38,_15_30,_8_37,_28_8,_20_24,_15_20,_29_14,_5_29,_18_16,_34,__6_26,__21,__6_2,__31,2_29,__27,_,__6,_,_,_,2_,__5_2,_,__7_2,2_,_,_,_,_,_,_,_,_9,__7;%22,%22Inner%20pivot%20&%20comp.%22,%22-48,-144;b,,144,672,,+,48,672,,+,48,672,,+,48,672,,z,120,48,48,,48,,48,,48,,48,,48,,48,,+48,96,576,,+48,48,576,,+48,48,240,,336,,+48,48,@-%CF%80/4,216,,96,,96,,48,,@%CF%80,96,144,,48,@%CF%80/2,624,288,@%CF%80/4,120,,48,,96,,96,;_16,_16,_16,_16,h,5_16,_17,n,7_17,h,8_23,_9_2_12,_8_15,_11_3,_10_9_3,_5_2_6_5,_6_2_13,_3_9_4,_4_2_6_3,_12,_11_,_11,_3_7,__9,_,_8,_7;%22,%22Adjustments%22,%22-48,-144;b,,144,672,,+,48,672,,+,48,672,,+,48,672,,z,120,48,48,,48,,48,,48,,48,,48,,48,,168,96,,48,+48,48,576,,+48,48,@-%CF%80/4,216,,96,,96,,48,,@%CF%80,48,144,,48,@%CF%80/2,624,288,@%CF%80/4,120,,48,,96,,96,;h,_25,n,2_15,h,3_24,n,4_14,h,5_14,n,6_14,_14,h,8_20,_8__11,_7_13,_7_2_2_6,_6_2_11,_4__5_5,_6_8_4,_2_7_4,_4_5,_9_,__8,_,2_7;%22]}">Circuit Simplification Demo</a>
    (for [this circuit](https://github.com/pnnl/QASMBench/blob/e8b65a5ffbbb1b25b91be0b11d6db874b70022e9/small/adder_n4/adder_n4.png))
* <a href="https://zx.cduck.me/#{%22g%22:%22;b,144,,288,240,x,192,48,+,192,48,,288,,z,192,,48,,144,,+,48,48,,288,,48,192;_6,_11,_4_4_,_,__5,_6_,h,7_,n,8_,h,9_4,n,10_;%22,%22s%22:[%22Teleportation%20Circuit%22,%22;b,144,,288,240,x,192,48,+,192,48,,288,,z,192,,48,,144,,+,48,48,,288,,48,192;_6,_11,_4_4_,_,__5,_6_,h,7_,n,8_,h,9_4,n,10_;%22,%22Merge%20Nodes%22,%2248;b,96,,288,240,x,144,48,,192,z,144,,120,,+,48,288,,48,192;_4,_7,_2_2_,_3__,h,5_,_3;%22,%22Toggle%20Colors%22,%2248;b,96,,288,240,z,144,,120,,+,48,144,,144,,+144,192,192,;_2,_7,h,3__2,_5,__2,_,_,_;%22,%22Remove%20Degree-2%22,%22144;b,,,288,240,z,168,,24,48,+144,72;_4,_3;%22]}">Quantum Teleportation Proof</a>
* <a href="https://zx.cduck.me/#{;b,,,192,,+,96,192,,+,96,192,,z,48,48,96,,+48,96,96,,@-%CF%80/4,,48,,96,192,,@%CF%80/4,96,,96,48,+96,48,,96;_13,_12,_13,_12,_12,_11,h,7_4_3_2,_6___,_3_2_3,_3_3_;}">Toffoli Graph (with 7 T rotations)</a>
* <a href="https://zx.cduck.me/#{;b,,,192,,+,96,192,,+,144,192,,z,96,,48,48,+96,48,+48,48,96,,@-%CF%80/2,96,240,@-%CF%80/4,192,48,,96,+96,48,@%CF%80/4,,144;_6,_5,_6,_5,_7,_6,h,7__2,_5_2,__,_5_,_3_,_3;}">Toffoli Graph (with 4 T rotations)</a>