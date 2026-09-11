import React from 'react';
import { Box, Circle, Cylinder, Cone, Triangle, Square, MousePointer2, Move, Rotate3D, Scale, Sparkles, MessageSquare, Plus, Trash2, Download, Menu, X, Undo, Redo, Layers, Brush, Palette, View, Grid3X3, Eye, EyeOff, Lock, Unlock, GitGraph, File, Upload, Spline, Maximize, SplitSquareHorizontal, Image as ImageIcon, PenTool, FoldVertical, Route, Waves, Group, Ungroup, Minus, Shapes, LassoSelect, Move3d, Droplets, Eraser, PaintBucket, Save, RotateCcw, Pentagon, Info } from 'lucide-react';

export const Icons = {
    Box, Circle, Cylinder, Cone, Triangle, Square, Plane: Square, File,
    Select: MousePointer2,
    Move, Rotate: Rotate3D, Scale,
    AI: Sparkles, Chat: MessageSquare,
    Add: Plus, Plus, 
    Minus, // Added for subtract selection
    Delete: Trash2, Export: Download,
    Menu, Close: X, Undo, Redo, Layers,
    Brush, Palette, View, Grid: Grid3X3,
    Eye, EyeOff, Lock, Unlock, 
    Loft: Route, 
    Upload,
    Spline,
    Save,
    CurvedPlane: Waves, 
    FitView: Maximize,
    Reset: RotateCcw, // New Reset Icon
    Symmetry: SplitSquareHorizontal,
    Image: ImageIcon,
    DrawOnShape: PenTool,
    Group, Ungroup,
    Shapes,
    Lasso: LassoSelect,
    Gizmo: Move3d,
    Blob: Droplets,
    Eraser,
    Fill: PaintBucket,
    FillShape: Pentagon, // New Fill Icon
    Info
};