import React from 'react';
import { 
    Box, Circle, Cylinder, Cone, Triangle, Square, MousePointer2, Move, Rotate3D, 
    Scaling, Sparkles, MessageSquare, Plus, Trash2, Download, Menu, X, Undo, Redo, 
    Layers, Brush, Palette, View, Grid3X3, Eye, EyeOff, Lock, Unlock, GitGraph, 
    File, Upload, Spline, Maximize, SplitSquareHorizontal, Image as ImageIcon, 
    PenTool, FoldVertical, Waves, Group, Ungroup, Minus, Shapes, LassoSelect, 
    Move3d, Droplets, Eraser, PaintBucket, Save, RotateCcw, Pentagon, Info,
    FolderInput, Library, Package, ArrowDownToLine, Pipette, Wand2
} from 'lucide-react';

// Dedicated CAD Loft SVG icon representing surface bridging between two 3D profiles
const LoftIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        {/* Top cross-section profile */}
        <path d="M4 6c4-3 12-3 16 0" />
        {/* Bottom cross-section profile */}
        <path d="M6 18c3-2 9-2 12 0" />
        {/* Left ruled surface boundary */}
        <path d="M4 6c1 5 1 9 2 12" />
        {/* Right ruled surface boundary */}
        <path d="M20 6c-1 5-1 9-2 12" />
        {/* Center surface flow ruling */}
        <path d="M12 4.5v12" strokeDasharray="2 2" />
    </svg>
);

export const Icons = {
    Box, Circle, Cylinder, Cone, Triangle, Square, Plane: Square, File,
    Select: MousePointer2,
    Move, Rotate: Rotate3D, 
    Scale: Scaling, // 3D Expansion / Scaling icon instead of balance scale
    AI: Sparkles, Sparkles, Chat: MessageSquare,
    Add: Plus,
    Plus, // Direct Plus icon
    Minus,
    Delete: Trash2, Export: Download,
    Menu, Close: X, Undo, Redo, Layers,
    Brush, Palette, View, Grid: Grid3X3,
    Eye, EyeOff, Lock, Unlock, 
    Loft: LoftIcon, // CAD Loft icon
    Upload,
    Spline,
    Save,
    CurvedPlane: Waves, 
    FitView: Maximize,
    Reset: RotateCcw,
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
    FillShape: Pentagon,
    Info,
    FolderInput,
    Library,
    Package,
    ArrowDownToLine,
    Pipette,
    Morph: Wand2
};