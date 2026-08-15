import React, { useState, useRef } from 'react';
import { 
  Search, Car, Layers, Folder, Plus, Loader2, ChevronRight, ChevronDown, 
  Image as ImageIcon, Info, Eye, Key, RefreshCw, LogIn, Printer, ChevronLeft, 
  ImageOff, Trash2, Minus, ShoppingCart
} from 'lucide-react';
import Toastify from 'toastify-js';
import { CHERY_EPC_URL } from '../utils/config';

export default function EpcExplorer({ 
  user, epcmToken, setEpcmToken, onAddPart, cheryModels = [],
  handleTestEpcConnection, isEpcTesting, handleEpcAutoLogin, isEpcLoggingIn,
  handleFetchEpcmToken, isFetchingEpcmToken, generatePdf, selectedParts = [],
  setSelectedParts
}) {
  const [vinCode, setVinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [treeData, setTreeData] = useState([]);
  const [selectedVin, setSelectedVin] = useState('');
  const [modelInfo, setModelInfo] = useState(null);
  
  // Navigation states
  const [expandedNodes, setExpandedNodes] = useState({});
  const [selectedPartlist, setSelectedPartlist] = useState(null);
  const [partlistDetails, setPartlistDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Part detail selection & tabs
  const [selectedPartRow, setSelectedPartRow] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('info');

  // Frontend cache for partlist details JSON to prevent double loading
  const [partlistCache, setPartlistCache] = useState({});

  // Global part search states
  const [searchPartNo, setSearchPartNo] = useState('');
  const [searchPartName, setSearchPartName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingParts, setIsSearchingParts] = useState(false);
  const [targetHighlightCode, setTargetHighlightCode] = useState(null);

  // Zoom & Pan states for 2D exploded drawing
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleTouchStart = (e) => {
    if (zoomScale <= 1) return;
    const touch = e.touches[0];
    setIsPanning(true);
    setPanStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
  };

  const handleTouchMove = (e) => {
    if (!isPanning) return;
    const touch = e.touches[0];
    setPanOffset({
      x: touch.clientX - panStart.x,
      y: touch.clientY - panStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const handleMouseDown = (e) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
  };

  // Lightbox slideshow state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(0);

  const getProductImageIds = () => {
    if (!selectedPartRow) return [];
    return [...(selectedPartRow.imageIds || []), ...(selectedPartRow.digifaxImageIds || [])];
  };

  const handleOpenLightbox = (index) => {
    setActiveLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const handleNextPhoto = () => {
    const ids = getProductImageIds();
    if (ids.length === 0) return;
    setActiveLightboxIndex((prev) => (prev + 1) % ids.length);
  };

  const handlePrevPhoto = () => {
    const ids = getProductImageIds();
    if (ids.length === 0) return;
    setActiveLightboxIndex((prev) => (prev - 1 + ids.length) % ids.length);
  };

  const [showToken, setShowToken] = useState(false);
  const imgRef = useRef(null);

  // Helper to extract coordinates/hotspots from the selected part row
  const getCoordinates = () => {
    if (!selectedPartRow) return null;
    const coords = selectedPartRow.coordinate || 
                   selectedPartRow.coordinateVos || 
                   selectedPartRow.coordinates || 
                   selectedPartRow.jsonProperties?.coordinate || 
                   selectedPartRow.jsonProperties?.coordinateVos;
    if (!coords) return null;
    
    if (typeof coords === 'string') {
      try {
        const parsed = JSON.parse(coords);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        const nums = coords.split(',').map(Number);
        if (nums.length === 4 && !nums.some(isNaN)) {
          const x = nums[0];
          const y = nums[1];
          const w = nums[2] > nums[0] ? (nums[2] - nums[0]) : nums[2];
          const h = nums[3] > nums[1] ? (nums[3] - nums[1]) : nums[3];
          return [{ x, y, width: w, height: h }];
        }
      }
    }
    
    if (Array.isArray(coords)) {
      return coords.map(c => {
        if (typeof c === 'object' && c !== null) {
          const x = c.x ?? c.x1 ?? c.left ?? 0;
          const y = c.y ?? c.y1 ?? c.top ?? 0;
          const w = c.width ?? c.w ?? (c.x2 ? (c.x2 - c.x1) : 0);
          const h = c.height ?? c.h ?? (c.y2 ? (c.y2 - c.y1) : 0);
          return { x, y, width: w, height: h };
        }
        return null;
      }).filter(Boolean);
    }
    
    if (typeof coords === 'object') {
      const x = coords.x ?? coords.x1 ?? coords.left ?? 0;
      const y = coords.y ?? coords.y1 ?? coords.top ?? 0;
      const w = coords.width ?? coords.w ?? (coords.x2 ? (coords.x2 - coords.x1) : 0);
      const h = coords.height ?? coords.h ?? (coords.y2 ? (coords.y2 - coords.y1) : 0);
      return [{ x, y, width: w, height: h }];
    }
    
    return null;
  };

  const getRenderedImageRect = () => {
    if (!imgRef.current) return null;
    const img = imgRef.current;
    const containerW = img.clientWidth;
    const containerH = img.clientHeight;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    
    if (!naturalW || !naturalH) return null;
    
    const imageRatio = naturalW / naturalH;
    const containerRatio = containerW / containerH;
    
    let renderedW, renderedH;
    if (imageRatio > containerRatio) {
      renderedW = containerW;
      renderedH = containerW / imageRatio;
    } else {
      renderedH = containerH;
      renderedW = containerH * imageRatio;
    }
    
    const offsetX = (containerW - renderedW) / 2;
    const offsetY = (containerH - renderedH) / 2;
    
    return {
      left: offsetX,
      top: offsetY,
      width: renderedW,
      height: renderedH,
      naturalWidth: naturalW,
      naturalHeight: naturalH
    };
  };

  const getRenderedCoords = (coord) => {
    const rect = getRenderedImageRect();
    if (!rect) return null;
    
    const scaleX = rect.width / rect.naturalWidth;
    const scaleY = rect.height / rect.naturalHeight;
    
    return {
      left: rect.left + coord.x * scaleX,
      top: rect.top + coord.y * scaleY,
      width: coord.width * scaleX,
      height: coord.height * scaleY
    };
  };

  // Helper to append session validation parameters to GET image requests
  const getAuthQueryParams = () => {
    let authUsername = '';
    let authSessionId = '';
    try {
      const savedUser = localStorage.getItem('chery_auth_user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        authUsername = userObj.username || '';
      }
      authSessionId = localStorage.getItem('chery_session_id') || '';
    } catch (e) {}
    return `&X-Auth-Username=${encodeURIComponent(authUsername)}&X-Auth-Session-Id=${encodeURIComponent(authSessionId)}`;
  };

  // Search VIN
  const handleVinSearch = async () => {
    if (!epcmToken) {
      Toastify({ text: "❌ Token EPCM belum diatur!", style: { background: "#ef4444" } }).showToast();
      return;
    }
    if (!vinCode.trim()) {
      Toastify({ text: "⚠️ Masukkan nomor rangka / VIN!", style: { background: "#f59e0b" } }).showToast();
      return;
    }

    setIsLoading(true);
    setTreeData([]);
    setSelectedPartlist(null);
    setPartlistDetails(null);
    setSelectedPartRow(null);

    try {
      // Step 1: Query VIN
      const vinResp = await fetch(`${CHERY_EPC_URL}?path=${encodeURIComponent('/api/rest/home/vin')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({ pageSize: 10, vinCode: vinCode.trim() })
      });
      const vinResult = await vinResp.json();
      
      const foundVins = vinResult.data || [];
      const activeVin = foundVins[0] || vinCode.trim();
      setSelectedVin(activeVin);

      // Step 2: Query Model Tree by VIN
      const treeResp = await fetch(`${CHERY_EPC_URL}?path=${encodeURIComponent('/api/rest/model/treeByVin')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({ code0: activeVin })
      });
      const treeResult = await treeResp.json();

      if (treeResult.success && treeResult.data) {
        const excludeNames = [
          'MODIFICATION RECORDS', 
          'VEHICLE INFORMATION', 
          'INITIAL INSTALLATION PARTS', 
          'MAINTENANCE RECORDS'
        ];
        const filterNodes = (nodes) => {
          if (!Array.isArray(nodes)) return [];
          return nodes
            .filter(n => n && n.name && !excludeNames.includes(n.name.toUpperCase().trim()))
            .map(n => ({
              ...n,
              children: n.children ? filterNodes(n.children) : undefined
            }));
        };
        const filteredData = filterNodes(treeResult.data);
        setTreeData(filteredData);
        if (filteredData.length > 0) {
          setModelInfo(filteredData[0]);
          Toastify({ text: `✅ Berhasil menemukan model catalog untuk VIN ${activeVin}`, style: { background: "#10b981" } }).showToast();
        } else {
          Toastify({ text: "⚠️ VIN ditemukan, tetapi model catalog kosong.", style: { background: "#f59e0b" } }).showToast();
        }
      } else {
        throw new Error(treeResult.message || "Gagal mendapatkan model tree");
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Error: " + e.message, style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle tree node expansion and load level if needed
  const toggleNode = async (node) => {
    const nodeId = node.id;
    const isExpanded = expandedNodes[nodeId];

    if (isExpanded) {
      setExpandedNodes(prev => ({ ...prev, [nodeId]: false }));
      return;
    }

    setExpandedNodes(prev => ({ ...prev, [nodeId]: true }));

    // If node already has children in tree, don't load again
    if (node.children && node.children.length > 0) return;

    // Load sub-level children from EPCM API
    try {
      const modelCode = modelInfo?.applic 
        ? modelInfo.applic.replace(/[()]/g, '').split('modelCode=')[1] || modelInfo.code 
        : '';
      
      const queryResp = await fetch(`${CHERY_EPC_URL}?path=${encodeURIComponent(`/api/rest/model/queryTreeByLevel?objectType=${node.objectType}&rootId=${node.id}`)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({
          objectType: node.objectType,
          rootId: node.id,
          code0: "CHERY",
          code1: modelCode,
          code2: "",
          code3: modelCode,
          config: selectedVin,
          config1: "",
          kd: true,
          lang: "en_US",
          name1: "",
          vinSearch: false
        })
      });
      const queryResult = await queryResp.json();

      if (queryResult.success && queryResult.data) {
        const excludeNames = [
          'MODIFICATION RECORDS', 
          'VEHICLE INFORMATION', 
          'INITIAL INSTALLATION PARTS', 
          'MAINTENANCE RECORDS'
        ];
        const filterNodes = (nodes) => {
          if (!Array.isArray(nodes)) return [];
          return nodes
            .filter(n => n && n.name && !excludeNames.includes(n.name.toUpperCase().trim()))
            .map(n => ({
              ...n,
              children: n.children ? filterNodes(n.children) : undefined
            }));
        };
        const filteredChildren = filterNodes(queryResult.data.children || []);

        // Update treeData node with fetched children
        const updateChildren = (nodes) => {
          return nodes.map(n => {
            if (n.id === node.id) {
              return { ...n, children: filteredChildren };
            } else if (n.children) {
              return { ...n, children: updateChildren(n.children) };
            }
            return n;
          });
        };
        setTreeData(prev => updateChildren(prev));
      }
    } catch (e) {
      console.error("Gagal memuat sub-level tree:", e);
    }
  };

  // Load Partlist Details (Exploded View Image & Parts Table)
  const handleSelectPartlist = async (node, highlightCode = null) => {
    setSelectedPartlist(node);
    setSelectedPartRow(null);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });

    const activeHighlight = highlightCode || targetHighlightCode;

    // If already in frontend cache, render instantly
    if (partlistCache[node.id]) {
      const cachedDetails = partlistCache[node.id];
      setPartlistDetails(cachedDetails);
      const items = cachedDetails.items || cachedDetails.content || [];
      let selectedRow = items[0];
      if (activeHighlight) {
        const matched = items.find(it => {
          const pCode = it.childCode || it.code || it.partCode || it.partNumber || '';
          return pCode.toUpperCase() === activeHighlight.toUpperCase();
        });
        if (matched) selectedRow = matched;
        setTargetHighlightCode(null);
      }
      if (selectedRow) {
        setSelectedPartRow(selectedRow);
      }
      return;
    }

    setPartlistDetails(null);
    setIsLoadingDetails(true);

    try {
      const modelCode = modelInfo?.applic 
        ? modelInfo.applic.replace(/[()]/g, '').split('modelCode=')[1] || modelInfo.code 
        : '';
      const rootId = modelInfo?.id || (treeData && treeData[0]?.id) || 1121216;

      const resp = await fetch(`${CHERY_EPC_URL}?path=${encodeURIComponent(`/api/rest/model/partlist/${node.id}?rootId=${rootId}`)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({
          applic: modelInfo?.applic || '',
          rootId: rootId,
          partlistId: node.id,
          code0: modelInfo?.code0 || "CHERY",
          code1: modelCode,
          code2: modelInfo?.code2 || "",
          code3: modelCode,
          config: selectedVin,
          config1: modelInfo?.config1 || "",
          kd: modelInfo?.kd !== undefined ? modelInfo.kd : true,
          lang: "en_US",
          name1: modelInfo?.name1 || "",
          plant: modelInfo?.plant || "",
          vinSearch: false
        })
      });
      const result = await resp.json();

      if (result.success && result.data) {
        const actualDetails = result.data.data || result.data;
        setPartlistDetails(actualDetails);
        
        // Save to frontend cache
        setPartlistCache(prev => ({ ...prev, [node.id]: actualDetails }));
        
        // Auto select first part row or the matched target code
        const items = actualDetails.items || actualDetails.content || [];
        let selectedRow = items[0];
        if (activeHighlight) {
          const matched = items.find(it => {
            const pCode = it.childCode || it.code || it.partCode || it.partNumber || '';
            return pCode.toUpperCase() === activeHighlight.toUpperCase();
          });
          if (matched) selectedRow = matched;
          setTargetHighlightCode(null);
        }
        if (selectedRow) {
          setSelectedPartRow(selectedRow);
        }
      } else {
        setPartlistDetails(result.payload || result || null);
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal memuat detail parts list", style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Global EPCM Part Search across the entire model
  const handleGlobalPartSearch = async () => {
    if (!epcmToken) {
      Toastify({ text: "❌ Token EPCM belum diatur!", style: { background: "#ef4444" } }).showToast();
      return;
    }
    if (!searchPartNo.trim() && !searchPartName.trim()) {
      Toastify({ text: "⚠️ Masukkan nomor atau nama sparepart!", style: { background: "#f59e0b" } }).showToast();
      return;
    }

    setIsSearchingParts(true);
    setSearchResults([]);

    try {
      const rootId = modelInfo?.id || (treeData && treeData[0]?.id) || 1501945;
      const modelCode = modelInfo?.applic 
        ? modelInfo.applic.replace(/[()]/g, '').split('modelCode=')[1] || modelInfo.code 
        : '';
      const catelogModel = {
        vinSearch: false,
        code0: modelInfo?.code0 || "CHERY",
        code1: modelCode,
        code2: modelInfo?.code2 || "",
        code3: modelCode,
        kd: modelInfo?.kd !== undefined ? modelInfo.kd : true,
        name1: modelInfo?.name1 || ""
      };

      const url = `${CHERY_EPC_URL}?path=${encodeURIComponent(`/api/rest/model/search/part/${rootId}`)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({
          catelogModel,
          code: searchPartNo.trim(),
          name: searchPartName.trim()
        })
      });
      const result = await resp.json();
      
      let contents = [];
      if (Array.isArray(result)) {
        contents = result;
      } else if (result.data) {
        contents = result.data.content || result.data.contents || result.data.items || (Array.isArray(result.data) ? result.data : []);
      } else if (result.payload) {
        contents = result.payload.content || result.payload.items || [];
      } else if (result.content) {
        contents = result.content;
      }

      setSearchResults(contents);
      if (contents.length === 0) {
        Toastify({ text: "⚠️ Tidak ditemukan sparepart yang cocok", style: { background: "#f59e0b" } }).showToast();
      } else {
        Toastify({ text: `✅ Menemukan ${contents.length} sparepart!`, style: { background: "#10b981" } }).showToast();
      }
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal mencari: " + e.message, style: { background: "#ef4444" } }).showToast();
    } finally {
      setIsSearchingParts(false);
    }
  };

  const handleSelectSearchResult = async (item) => {
    const rootId = modelInfo?.id || (treeData && treeData[0]?.id) || 1501945;
    const modelCode = modelInfo?.applic 
      ? modelInfo.applic.replace(/[()]/g, '').split('modelCode=')[1] || modelInfo.code 
      : '';
    const catelogModel = {
      vinSearch: false,
      code0: modelInfo?.code0 || "CHERY",
      code1: modelCode,
      code2: modelInfo?.code2 || "",
      code3: modelCode,
      kd: modelInfo?.kd !== undefined ? modelInfo.kd : true,
      name1: modelInfo?.name1 || ""
    };

    setIsLoadingDetails(true);

    try {
      const itemId = item.partlistId || item.parentId || item.id || item.bomLineId;
      const itemObjectType = item.partlistId ? "Partlist" : (item.parentObjectType || (item.objectType || "Part"));
      
      const pathResp = await fetch(`${CHERY_EPC_URL}?path=${encodeURIComponent('/api/rest/base/search/partPath')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': epcmToken
        },
        body: JSON.stringify({
          rootId: rootId,
          code: item.code || item.childCode || item.partCode || '',
          id: itemId,
          objectType: itemObjectType,
          catelogModel
        })
      });
      const pathResult = await pathResp.json();
      
      const scanForPartlistId = (obj) => {
        if (!obj) return null;
        if (Array.isArray(obj)) {
          for (const val of obj) {
            const res = scanForPartlistId(val);
            if (res) return res;
          }
        } else if (typeof obj === 'object') {
          if (obj.objectType === 'Partlist' && obj.id) return obj.id;
          if (obj.partlistId) return obj.partlistId;
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              const res = scanForPartlistId(obj[key]);
              if (res) return res;
            }
          }
        }
        return null;
      };

      let targetPartlistId = scanForPartlistId(pathResult);
      let targetNodeName = item.partlistName || 'Detail Partlist';

      if (!targetPartlistId) {
        const pathData = pathResult.data || pathResult;
        if (Array.isArray(pathData)) {
          const plistNode = pathData.find(n => n.objectType === 'Partlist');
          if (plistNode) {
            targetPartlistId = plistNode.id;
            targetNodeName = plistNode.name || targetNodeName;
          } else if (pathData.length > 0) {
            const lastNode = pathData[pathData.length - 1];
            targetPartlistId = lastNode.id;
            targetNodeName = lastNode.name || targetNodeName;
          }
        } else if (pathData && typeof pathData === 'object') {
          targetPartlistId = pathData.id || pathData.partlistId;
          targetNodeName = pathData.name || targetNodeName;
        }
      }

      if (!targetPartlistId) {
        targetPartlistId = item.partlistId || item.id;
      }
      
      if (!targetPartlistId) {
        console.error("Path Result:", pathResult);
        throw new Error("ID lokasi partlist tidak ditemukan.");
      }

      const partCode = item.code || item.childCode || item.partCode || item.partNumber || '';
      setTargetHighlightCode(partCode);

      await handleSelectPartlist({
        id: targetPartlistId,
        name: targetNodeName,
        objectType: 'Partlist'
      }, partCode);
    } catch (e) {
      console.error(e);
      Toastify({ text: "❌ Gagal mengarahkan lokasi: " + e.message, style: { background: "#ef4444" }, duration: 6000 }).showToast();
      setIsLoadingDetails(false);
    }
  };

  // Render tree helper
  const renderTreeNode = (node, depth = 0) => {
    const isExpanded = expandedNodes[node.id];
    const isLeaf = node.objectType === 'Partlist';
    const isSelected = selectedPartlist?.id === node.id;

    return (
      <div key={node.id} className="select-none">
        <div 
          onClick={() => isLeaf ? handleSelectPartlist(node) : toggleNode(node)}
          style={{ paddingLeft: `${depth * 10 + 8}px` }}
          className={`flex items-center gap-1.5 py-1.5 pr-2 text-[10.5px] font-bold uppercase tracking-wider rounded-md cursor-pointer transition-all duration-150
            ${isSelected 
              ? 'bg-zinc-900 text-white shadow-sm' 
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`}
        >
          {!isLeaf && (
            <span>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
          {isLeaf ? (
            <ImageIcon size={12} className="text-emerald-500 shrink-0" />
          ) : (
            <Folder size={12} className="text-zinc-400 shrink-0" />
          )}
          <span className="truncate">{node.name || node.code}</span>
        </div>

        {isExpanded && node.children && node.children.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  // Get parts list array from EPCM response details
  const getPartsArray = () => {
    if (!partlistDetails) return [];
    if (Array.isArray(partlistDetails.items)) return partlistDetails.items;
    if (Array.isArray(partlistDetails.content)) return partlistDetails.content;
    if (Array.isArray(partlistDetails)) return partlistDetails;
    return [];
  };

  // Extract Exploded View image ID from response (twoDFiles or imgSrc)
  const getDrawingImageId = () => {
    if (!partlistDetails) return null;
    if (Array.isArray(partlistDetails.twoDFiles) && partlistDetails.twoDFiles.length > 0) {
      return partlistDetails.twoDFiles[0].id;
    }
    return partlistDetails.imgSrc || selectedPartlist?.imgSrc || null;
  };

  return (
    <div className="w-full space-y-4">
      {/* Unified Toolbar Bar */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        {/* Left: VIN Search input */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={vinCode}
              onChange={(e) => setVinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVinSearch()}
              placeholder="Masukkan VIN / Nomor Rangka..."
              className="bg-white border border-zinc-200 rounded-md pl-10 pr-4 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 w-64 transition-all"
            />
          </div>
          <button
            onClick={handleVinSearch}
            disabled={isLoading}
            className="bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-black text-xs px-5 py-2 rounded-md transition-all active:scale-95 flex items-center gap-1.5 h-[34px]"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'EXPLORE'}
          </button>
        </div>

        {/* Right: Token management only for Owner */}
        <div className="flex items-center gap-3">
          {user?.role === 'owner' && (
             <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md p-1 pr-4 focus-within:border-zinc-900 transition-all h-[36px]">
                <div className="flex items-center gap-2 pl-3">
                  <Key size={14} className={epcmToken ? "text-zinc-900" : "text-zinc-400"} />
                  <input 
                    type={showToken ? "text" : "password"}
                    value={epcmToken}
                    onChange={(e) => setEpcmToken(e.target.value)}
                    placeholder="EPCM Token..."
                    className="bg-transparent border-none text-xs text-zinc-900 placeholder:text-zinc-350 focus:ring-0 w-32 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-zinc-400 hover:text-zinc-950 p-1"
                    title={showToken ? "Hide Token" : "Show Token"}
                  >
                    <Eye size={13} />
                  </button>
                </div>
                <button 
                  onClick={handleTestEpcConnection}
                  disabled={isEpcTesting}
                  className="p-1 hover:bg-zinc-150 rounded-md text-zinc-500 hover:text-zinc-900 transition-colors"
                  title="Test Koneksi EPCM"
                >
                  <RefreshCw size={13} className={isEpcTesting ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={handleEpcAutoLogin}
                  disabled={isEpcLoggingIn}
                  className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm text-[9px] font-black px-2.5 py-1 rounded-md transition-all uppercase tracking-wider disabled:opacity-50"
                >
                  {isEpcLoggingIn ? "..." : "Auto Login"}
                </button>
                <button 
                  onClick={handleFetchEpcmToken}
                  disabled={isFetchingEpcmToken}
                  className="bg-white hover:bg-zinc-50 text-zinc-900 font-bold border border-zinc-300 shadow-sm text-[9px] font-black px-2 py-1 rounded-md transition-all uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                  title="Ambil token dari session EPCM"
                >
                  <LogIn size={11} className={isFetchingEpcmToken ? "animate-pulse" : ""} />
                  {isFetchingEpcmToken ? "..." : "Ambil"}
                </button>
             </div>
          )}
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
        {/* Column 1: Navigation Tree (lg:col-span-2) */}
        <div className="lg:col-span-2 border-r border-zinc-200 bg-white p-3 max-h-[85vh] overflow-y-auto flex flex-col gap-4 custom-scrollbar">
          
          {/* Global Part Search Section */}
          {treeData.length > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-2.5 space-y-2 shrink-0 shadow-sm">
              <div className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest">Cari Sparepart Global</div>
              <div className="space-y-1.5">
                <input 
                  type="text"
                  placeholder="Cari Nomor Part..."
                  value={searchPartNo}
                  onChange={(e) => setSearchPartNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGlobalPartSearch()}
                  className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-950 focus:outline-none focus:border-zinc-900"
                />
                <input 
                  type="text"
                  placeholder="Cari Nama Part..."
                  value={searchPartName}
                  onChange={(e) => setSearchPartName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGlobalPartSearch()}
                  className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-950 focus:outline-none focus:border-zinc-900"
                />
                <button
                  onClick={handleGlobalPartSearch}
                  disabled={isSearchingParts}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-250 disabled:text-zinc-400 text-white font-black text-[9px] py-1.5 rounded transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                  {isSearchingParts ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                  Cari Part
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border-t border-zinc-200 pt-2 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                  <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex justify-between">
                    <span>Hasil ({searchResults.length})</span>
                    <button onClick={() => setSearchResults([])} className="hover:text-zinc-900 uppercase">Clear</button>
                  </div>
                  <div className="divide-y divide-zinc-200">
                    {searchResults.map((item, idx) => {
                      const pNo = item.code || item.childCode || item.partCode || item.partNumber || '';
                      const pName = item.partNameEn || item.childName || item.name || '';
                      const chName = item.partlistName || 'Detail';
                      const posNum = item.pos || item.position || item.ballNumber || item.bomLineId || '';
                      return (
                        <div 
                          key={idx}
                          onClick={() => handleSelectSearchResult(item)}
                          className="py-1.5 cursor-pointer hover:bg-zinc-200 rounded px-1 transition-all text-[9.5px] space-y-0.5"
                        >
                          <div className="font-bold text-zinc-950 truncate font-mono">{pNo}</div>
                          <div className="text-zinc-600 truncate uppercase font-semibold">{pName}</div>
                          <div className="text-zinc-400 text-[8.5px] truncate">📍 {chName} (Pos: {posNum})</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1 mb-0.5 shrink-0">Model Chapters</div>
          
          {treeData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-xs italic gap-1.5 text-center p-3">
              <Layers size={20} className="opacity-20" />
              <span>Belum ada data.<br/>Masukkan VIN untuk memuat catalog.</span>
            </div>
          ) : (
            <div className="space-y-0.5 flex-1 overflow-y-auto no-scrollbar">
              {treeData.map(node => renderTreeNode(node))}
            </div>
          )}
        </div>

        {/* Column 2: Exploded View Drawing & Parts Table (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-zinc-50/30 p-4 flex flex-col space-y-4 max-h-[85vh] overflow-y-auto border-r border-zinc-200">
          {!selectedPartlist ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 h-96">
              <ImageIcon size={48} className="opacity-10 text-zinc-900" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Pilih partlist di menu kiri untuk melihat gambar</p>
            </div>
          ) : isLoadingDetails ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3 h-96">
              <Loader2 size={32} className="animate-spin text-zinc-900" />
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Memuat detail partlist...</p>
            </div>
          ) : (
            <>
              {/* Exploded View Image Container */}
              <div 
                className="bg-white border border-zinc-200 rounded-lg p-3 flex flex-col items-center justify-center h-[350px] shadow-sm relative overflow-hidden group/img select-none cursor-grab active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Floating Zoom Controls */}
                {getDrawingImageId() && (
                  <div className="absolute bottom-2 right-2 flex gap-1 bg-zinc-950/90 text-white rounded-md p-1 shadow-lg z-20">
                    <button 
                      type="button" 
                      onClick={handleZoomIn} 
                      className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-xs transition-all"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button 
                      type="button" 
                      onClick={handleZoomOut} 
                      className="w-6 h-6 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-xs transition-all"
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <button 
                      type="button" 
                      onClick={handleResetZoom} 
                      className="px-2 h-6 flex items-center justify-center hover:bg-zinc-800 rounded font-black text-[8px] uppercase tracking-wider transition-all"
                      title="Reset 1:1"
                    >
                      1:1
                    </button>
                  </div>
                )}

                {getDrawingImageId() ? (
                  <div 
                    className="w-full h-full relative flex items-center justify-center transition-transform duration-100 ease-out"
                    style={{
                      transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <img 
                      ref={imgRef}
                      src={`${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/base/file/view/${getDrawingImageId()}`)}${getAuthQueryParams()}`}
                      className="w-full h-full object-contain p-1 pointer-events-none" 
                      alt="Exploded View Drawing" 
                    />
                    
                    {/* Highlight Box Overlay */}
                    {getCoordinates()?.map((coord, idx) => {
                      const rendered = getRenderedCoords(coord);
                      if (!rendered) return null;
                      return (
                        <div 
                          key={idx}
                          className="absolute border-2 border-red-500 bg-red-500/20 rounded pointer-events-none animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10"
                          style={{
                            left: `${rendered.left}px`,
                            top: `${rendered.top}px`,
                            width: `${rendered.width}px`,
                            height: `${rendered.height}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center space-y-2 text-zinc-400">
                    <ImageOff size={32} className="mx-auto text-zinc-350" />
                    <p className="text-[10px] font-black text-zinc-800 uppercase tracking-widest">Mohon maaf, image tidak ada</p>
                  </div>
                )}
              </div>

              {/* Table of Parts (Stacked below image) */}
              <div className="flex flex-col h-[300px] justify-between">
                <div className="space-y-2 flex-1 flex flex-col min-h-0">
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Parts List ({getPartsArray().length} items)</div>
                  
                  <div 
                    className="border border-zinc-200 rounded-lg bg-white shadow-sm flex-1 overflow-y-auto overflow-x-auto custom-scrollbar p-2"
                    style={{ maxHeight: '250px', WebkitOverflowScrolling: 'touch' }}
                  >
                    {/* Desktop View (Table layout) - hidden on mobile */}
                    <table className="w-full text-left border-collapse min-w-[500px] hidden md:table">
                      <thead>
                        <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-black text-zinc-500 uppercase tracking-wider sticky top-0 z-10">
                          <th className="py-2 px-3 w-10 text-center">Pos</th>
                          <th className="py-2 px-3">Part Code</th>
                          <th className="py-2 px-3">Part Name</th>
                          <th className="py-2 px-3 w-10 text-center">Qty</th>
                          <th className="py-2 px-3 w-12 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 text-xs font-semibold text-zinc-700">
                        {getPartsArray().length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-zinc-400 italic">Tidak ada part item di daftar ini</td>
                          </tr>
                        ) : (
                          getPartsArray().map((part, idx) => {
                            const partNum = part.childCode || part.code || part.partCode || part.partNumber || '-';
                            const partName = part.partNameEn || part.childName || part.name || part.partName || part.chineseName || '-';
                            const position = (part.ballNumber || part.bomLineId || part.lineNumber || part.pos || '').toString().trim() || (idx + 1);
                            const qty = part.jsonProperties?.iba_quantity || part.dosage || part.qty || part.quantity || 1;
                            const isRowSelected = selectedPartRow?.id === part.id;
                            
                            return (
                              <tr 
                                key={idx} 
                                onClick={() => setSelectedPartRow(part)}
                                className={`cursor-pointer transition-colors ${isRowSelected ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50'}`}
                              >
                                <td className={`py-2 px-3 text-center font-black ${isRowSelected ? 'text-white' : 'text-emerald-600'}`}>{position}</td>
                                <td className={`py-2 px-3 font-mono font-bold ${isRowSelected ? 'text-white' : 'text-zinc-950'}`}>{partNum}</td>
                                <td className={`py-2 px-3 uppercase truncate max-w-[200px] ${isRowSelected ? 'text-white' : ''}`}>{partName}</td>
                                <td className="py-2 px-3 text-center">{qty}</td>
                                <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      const firstImgId = (part.imageIds?.[0] || part.digifaxImageIds?.[0] || part.fileIds?.[0] || part.imageId);
                                      const imageUrl = firstImgId ? `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/base/file/view/${firstImgId}`)}${getAuthQueryParams()}` : null;
                                      const modelName = modelInfo?.jsonProperties?.iba_model || 
                                                        modelInfo?.applic?.replace(/[()]/g, '').split('modelCode=')[1] || 
                                                        modelInfo?.code || 
                                                        'OTHER';
                                      onAddPart({
                                        code: partNum,
                                        name: partName,
                                        retailGuidePrice: 0,
                                        image: imageUrl,
                                        models: modelName
                                      });
                                    }}
                                    className={`p-1 rounded-md border transition-all active:scale-90
                                      ${isRowSelected 
                                        ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-white hover:text-zinc-950' 
                                        : 'bg-zinc-50 hover:bg-zinc-900 border-zinc-200 text-zinc-600 hover:text-white'}`}
                                    title="Add to Quotation Document"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Mobile View (Card List layout) - shown only on mobile */}
                    <div className="block md:hidden space-y-2">
                      {getPartsArray().length === 0 ? (
                        <div className="py-8 text-center text-zinc-400 italic text-xs">Tidak ada part item di daftar ini</div>
                      ) : (
                        getPartsArray().map((part, idx) => {
                          const partNum = part.childCode || part.code || part.partCode || part.partNumber || '-';
                          const partName = part.partNameEn || part.childName || part.name || part.partName || part.chineseName || '-';
                          const position = (part.ballNumber || part.bomLineId || part.lineNumber || part.pos || '').toString().trim() || (idx + 1);
                          const qty = part.jsonProperties?.iba_quantity || part.dosage || part.qty || part.quantity || 1;
                          const isRowSelected = selectedPartRow?.id === part.id;
                          
                          return (
                            <div 
                              key={idx}
                              onClick={() => setSelectedPartRow(part)}
                              className={`p-3 rounded-lg border transition-all cursor-pointer flex justify-between items-center gap-2
                                ${isRowSelected ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm' : 'bg-white border-zinc-200 hover:border-zinc-300'}`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isRowSelected ? 'bg-zinc-800 text-white' : 'bg-zinc-150 text-zinc-650'}`}>
                                    Pos {position}
                                  </span>
                                  <span className={`font-mono font-bold text-xs ${isRowSelected ? 'text-white' : 'text-zinc-900'}`}>
                                    {partNum}
                                  </span>
                                </div>
                                <div className={`text-[10px] uppercase font-bold truncate max-w-[210px] ${isRowSelected ? 'text-zinc-350' : 'text-zinc-750'}`} title={partName}>
                                  {partName}
                                </div>
                                <div className={`text-[9px] font-medium ${isRowSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                  Quantity: <span className="font-bold">{qty}</span>
                                </div>
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstImgId = (part.imageIds?.[0] || part.digifaxImageIds?.[0] || part.fileIds?.[0] || part.imageId);
                                  const imageUrl = firstImgId ? `${CHERY_EPC_URL}?token=${encodeURIComponent(epcmToken)}&path=${encodeURIComponent(`/api/rest/base/file/view/${firstImgId}`)}${getAuthQueryParams()}` : null;
                                  const modelName = modelInfo?.jsonProperties?.iba_model || 
                                                    modelInfo?.applic?.replace(/[()]/g, '').split('modelCode=')[1] || 
                                                    modelInfo?.code || 
                                                    'OTHER';
                                  onAddPart({
                                    code: partNum,
                                    name: partName,
                                    retailGuidePrice: 0,
                                    image: imageUrl,
                                    models: modelName
                                  });
                                }}
                                className={`p-2 rounded-lg border transition-all active:scale-90 shrink-0
                                  ${isRowSelected 
                                    ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-white hover:text-zinc-900' 
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-950 hover:text-white'}`}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Part Specifications & Tabs */}
              {selectedPartRow && (
                <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm space-y-3">
                  <div className="flex border-b border-zinc-200 gap-4">
                    <button
                      onClick={() => setActiveDetailTab('info')}
                      className={`pb-2 font-black text-[10px] uppercase tracking-wider border-b-2 transition-all flex items-center gap-1
                        ${activeDetailTab === 'info' 
                          ? 'border-zinc-950 text-zinc-950' 
                          : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                    >
                      <Info size={12} />
                      Info
                    </button>
                    <button
                      onClick={() => setActiveDetailTab('photos')}
                      className={`pb-2 font-black text-[10px] uppercase tracking-wider border-b-2 transition-all flex items-center gap-1
                        ${activeDetailTab === 'photos' 
                          ? 'border-zinc-950 text-zinc-950' 
                          : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                    >
                      <Eye size={12} />
                      Real Photos ({(selectedPartRow.imageIds?.length || 0) + (selectedPartRow.digifaxImageIds?.length || 0)})
                    </button>
                  </div>

                  {activeDetailTab === 'info' && (
                    <div className="grid grid-cols-3 gap-4 text-[11px] text-zinc-700">
                      <div>
                        <span className="font-bold text-zinc-400 uppercase text-[8.5px] block">Part Number</span>
                        <span className="font-black text-zinc-900 font-mono">{selectedPartRow.childCode || selectedPartRow.code || '-'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400 uppercase text-[8.5px] block">Part Name</span>
                        <span className="font-black text-zinc-900 uppercase truncate block">{selectedPartRow.partNameEn || selectedPartRow.childName || selectedPartRow.name || '-'}</span>
                      </div>
                      <div>
                        <span className="font-bold text-zinc-400 uppercase text-[8.5px] block">Quantity</span>
                        <span className="font-bold text-zinc-800">{selectedPartRow.jsonProperties?.iba_quantity || selectedPartRow.dosage || 1}</span>
                      </div>
                    </div>
                  )}

                  {activeDetailTab === 'photos' && (
                    <div className="space-y-2">
                      {getProductImageIds().length === 0 ? (
                        <div className="py-4 text-center text-zinc-400 italic text-[11px]">
                          Belum ada foto produk asli untuk part ini.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {getProductImageIds().map((imgId, idx) => (
                             <div 
                               key={idx}
                               onClick={() => handleOpenLightbox(idx)}
                               className="w-12 h-12 bg-zinc-50 border border-zinc-200 rounded p-1 flex items-center justify-center hover:border-zinc-900 transition-all overflow-hidden relative shadow-sm cursor-pointer"
                             >
                               <img 
                                 src={`https://qrepcm.mychery.com/api/rest/base/file/view/${imgId}?token=${encodeURIComponent(epcmToken.startsWith('Bearer') ? epcmToken : `Bearer ${epcmToken}`)}`}
                                 className="w-full h-full object-contain"
                                 alt=""
                               />
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Column 3: Cart Estimasi Panel (lg:col-span-3) */}
        <div className="lg:col-span-3 bg-white p-4 flex flex-col justify-between max-h-[85vh] overflow-y-auto">
          <div className="flex flex-col flex-1 min-h-0">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-3 shrink-0">
              <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-1.5 text-zinc-900">
                <ShoppingCart size={14} className="text-zinc-650" />
                Cart Estimasi ({selectedParts.length})
              </h3>
              {selectedParts.length > 0 && (
                <button 
                  onClick={() => setSelectedParts([])}
                  className="text-[10px] font-black uppercase text-red-650 hover:text-red-750 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar min-h-[300px]">
              {selectedParts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 italic text-xs py-12 text-center gap-2">
                  <ShoppingCart size={28} className="opacity-10" />
                  <span>Cart masih kosong.<br/>Klik tombol "+" pada tabel parts list untuk menambahkan.</span>
                </div>
              ) : (
                selectedParts.map((item, idx) => (
                  <div key={idx} className="bg-zinc-50 border border-zinc-200 p-2 rounded-lg flex gap-2 relative group hover:border-zinc-300 transition-all">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 bg-white border border-zinc-200 rounded p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <img src={item.image} className="w-full h-full object-contain" alt="" />
                      ) : (
                        <ImageOff size={14} className="text-zinc-350" />
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="font-mono font-bold text-[10px] text-zinc-900 truncate">{item.code}</div>
                      <div className="text-[9.5px] text-zinc-500 uppercase truncate font-medium">{item.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-bold text-zinc-800">
                          {item.priceExc === 0 ? (
                            <span className="text-[9px] text-zinc-400 font-semibold italic">Masih belum ada harga</span>
                          ) : (
                            new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.priceExc)
                          )}
                        </span>
                        
                        {/* Qty Controls */}
                        <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded px-1 py-0.5 scale-90 origin-right">
                          <button
                            onClick={() => setSelectedParts(prev => prev.map((p, i) => i === idx ? { ...p, qty: Math.max(1, (p.qty || 1) - 1) } : p))}
                            className="p-0.5 hover:bg-zinc-100 rounded text-zinc-550 transition-colors"
                          >
                            <Minus size={9} />
                          </button>
                          <span className="text-[9.5px] font-black text-zinc-900 w-4 text-center font-mono">
                            {item.qty || 1}
                          </span>
                          <button
                            onClick={() => setSelectedParts(prev => prev.map((p, i) => i === idx ? { ...p, qty: (p.qty || 1) + 1 } : p))}
                            className="p-0.5 hover:bg-zinc-100 rounded text-zinc-550 transition-colors"
                          >
                            <Plus size={9} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Delete absolute button */}
                    <button
                      onClick={() => setSelectedParts(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-600 border border-zinc-200 hover:border-red-200 rounded-full w-5 h-5 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Footer Calculations & Print */}
          <div className="border-t border-zinc-200 pt-3 mt-3 space-y-3 shrink-0">
            <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>Total Qty:</span>
              <span className="text-zinc-900 font-black">
                {selectedParts.reduce((acc, curr) => acc + (curr.qty || 1), 0)}
              </span>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span>Total Exc PPN:</span>
              <span className="text-zinc-950 font-black">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
                  selectedParts.reduce((acc, curr) => acc + ((curr.priceExc || 0) * (curr.qty || 1)), 0)
                )}
              </span>
            </div>
            <button
              onClick={() => generatePdf(selectedVin || vinCode)}
              disabled={selectedParts.length === 0}
              className="w-full bg-zinc-950 hover:bg-zinc-900 text-white font-black text-[11px] py-2 rounded-lg tracking-wider uppercase transition-all shadow-md active:scale-95 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:shadow-none flex items-center justify-center gap-1.5 h-9"
            >
              <Printer size={12} />
              Export PDF Estimasi
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && getProductImageIds().length > 0 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in">
          <button 
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-all active:scale-95 z-50 flex items-center justify-center"
          >
            <span className="text-xl font-bold font-mono">✕</span>
          </button>

          <div className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center justify-center gap-4">
            {getProductImageIds().length > 1 && (
              <button 
                onClick={handlePrevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3.5 rounded-full transition-all active:scale-95 z-50"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <img 
              src={`https://qrepcm.mychery.com/api/rest/base/file/view/${getProductImageIds()[activeLightboxIndex]}?token=${encodeURIComponent(epcmToken.startsWith('Bearer') ? epcmToken : `Bearer ${epcmToken}`)}`}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
              alt="Real Part Specimen" 
            />

            {getProductImageIds().length > 1 && (
              <button 
                onClick={handleNextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white p-3.5 rounded-full transition-all active:scale-95 z-50"
              >
                <ChevronRight size={24} />
              </button>
            )}

            <div className="text-white text-xs font-bold bg-black/40 px-4 py-1.5 rounded-full tracking-wider uppercase select-none">
              Photo {activeLightboxIndex + 1} of {getProductImageIds().length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
