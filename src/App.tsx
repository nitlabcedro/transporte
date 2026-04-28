/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Search, 
  CheckCircle2, 
  Loader2, 
  FileSpreadsheet,
  AlertCircle,
  X,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  BarChart2,
  PieChart as PieChartIcon,
  Activity,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as PDFJS from 'pdfjs-dist';
import * as XLSX from 'xlsx-js-style';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { cn } from './lib/utils';
import { supabase } from './lib/supabase';
import { Database, Save, Cloud } from 'lucide-react';

// Set worker for pdfjs using unpkg as a reliable CDN for the specific version
const PDFJS_VERSION = PDFJS.version;
PDFJS.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

interface ExtractedRow {
  id?: string; // Supabase ID
  moto: string;
  peca: string;
  codigo: string;
  quantidade: string;
  preco_unitario: string;
  preco_total: string;
  fornecedor: string;
  data: string;
  observacao: string;
  arquivo_pdf: string;
  pagina: string;
  placa: string;
  marca: string;
  modelo: string;
  os: string;
  km: string;
  total_produtos: string;
  total_servicos: string;
  total_geral: string;
}

interface DocumentSummary {
  arquivo_pdf: string;
  placa: string;
  marca: string;
  modelo: string;
  moto: string;
  data: string;
  os: string;
  km: string;
  observacao: string;
  fornecedor: string;
  total_produtos: string;
  total_servicos: string;
  total_geral: string;
  itens_extraidos: number;
}

// Helper functions matching Python logic
const DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/;
const MONEY_IN_TEXT_REGEX = /R\$\s*([\d\.]+,\d{2})/g;
const ITEM_LINE_REGEX = /^(\d{7,14})\s+(.+?)\s+R?\$?\s*([\d\.]+,\d{2})\s+(\d+(?:[.,]\d+)?)\s+R?\$?\s*([\d\.]+,\d{2})$/;
const TOTAL_LABEL_REGEX = /Total (Produtos|Serviços|Servicos|Geral)/i;
const ORDER_NO_REGEX = /\b0{0,2}\d{7,10}\b/;

function normalizeText(text: string): string {
  if (!text) return "";
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(value: string): string {
  if (!value) return "";
  const txt = value.replace(/R\$/g, "").replace(/\./g, "").replace(/,/g, ".").trim();
  const num = parseFloat(txt);
  return isNaN(num) ? "" : num.toFixed(2);
}

function cleanNumeric(value: string): string {
  if (!value) return "";
  return value.replace(/\./g, "").replace(/,/g, ".").trim();
}

function cleanupProductName(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(/ -$/, "").replace(/ R\$$/, "");
}

function normalizePlate(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedRow[]>([]);
  const [summaries, setSummaries] = useState<DocumentSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPlate, setFilterPlate] = useState("");
  const [currentStep, setCurrentStep] = useState<'upload' | 'view' | 'dashboard'>('upload');
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'disconnected'>('disconnected');

  // Fetch data on mount
  useEffect(() => {
    if (!supabase) {
      setConfigError(true);
    }
    checkConnection();
    fetchFromSupabase();
  }, []);

  const checkConnection = async () => {
    if (!supabase) {
      setDbStatus('disconnected');
      setConfigError(true);
      return;
    }
    setConfigError(false);
    try {
      const { error } = await supabase.from('extracted_data').select('id').limit(1);
      if (error) {
        if (error.code === 'PGRST125') {
          setSupabaseError(true);
        }
        setDbStatus('error');
      } else {
        setDbStatus('connected');
        setSupabaseError(false);
      }
    } catch (e) {
      setDbStatus('error');
    }
  };

  const fetchFromSupabase = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('extracted_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST125') {
          console.error("Tabela 'extracted_data' não encontrada na API.");
          setSupabaseError(true);
          return;
        }
        throw error;
      }
      if (data && data.length > 0) {
        setExtractedData(data);
        // Also regenerate summaries based on fetched data
        const uniqueDocs = Array.from(new Set(data.map(d => d.arquivo_pdf)));
        const newSummaries: DocumentSummary[] = uniqueDocs.map(pdf => {
          const docRows = data.filter(d => d.arquivo_pdf === pdf);
          const first = docRows[0];
          return {
            arquivo_pdf: pdf,
            placa: first.placa,
            marca: first.marca,
            modelo: first.modelo,
            moto: first.moto,
            data: first.data,
            os: first.os,
            km: first.km,
            observacao: first.observacao,
            fornecedor: first.fornecedor,
            total_produtos: first.total_produtos,
            total_servicos: first.total_servicos,
            total_geral: first.total_geral,
            itens_extraidos: docRows.length
          };
        });
        setSummaries(newSummaries);
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleUpdateValue = async (rowToUpdate: ExtractedRow, field: keyof ExtractedRow, value: string) => {
    // Update local state first for responsiveness
    setExtractedData(prev => prev.map(row => {
      if (row === rowToUpdate) {
        return { ...row, [field]: value };
      }
      return row;
    }));

    // If the row has an ID, update Supabase directly
    if (rowToUpdate.id && supabase) {
      try {
        const { error } = await supabase
          .from('extracted_data')
          .update({ [field]: value })
          .eq('id', rowToUpdate.id);

        if (error) throw error;
      } catch (error) {
        console.error("Erro ao atualizar no Supabase:", error);
      }
    }
  };

  const importBaseExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        let allImportedRows: ExtractedRow[] = [];

        wb.SheetNames.forEach(wsname => {
          const ws = wb.Sheets[wsname];
          // Get raw data as array of arrays to find headers
          const rowsRaw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (rowsRaw.length === 0) return;

          // Find the header row (the first row that contains known keywords)
          let headerIdx = -1;
          const keywords = ['PLACA', 'PECA', 'ITEM', 'SERVICO', 'MOTO', 'VEICULO'];
          
          for (let i = 0; i < Math.min(rowsRaw.length, 10); i++) {
            const row = rowsRaw[i];
            const rowStr = JSON.stringify(row).toUpperCase();
            if (keywords.some(k => rowStr.includes(k))) {
              headerIdx = i;
              break;
            }
          }

          if (headerIdx === -1) return;

          // Convert to JSON starting from the header row
          const rowsJson = XLSX.utils.sheet_to_json(ws, { range: headerIdx }) as any[];

          const mappedRows = rowsJson.map(r => {
            // Flexible mapping for various sheet formats
            const getVal = (possibleKeys: string[]) => {
              const foundKey = possibleKeys.find(k => r[k] !== undefined);
              return foundKey ? String(r[foundKey]) : '';
            };

            const peca = getVal(['PEÇA / SERVIÇO', 'Item / Serviço', 'SERVIÇO/PRODUTO', 'peca', 'PEÇA', 'SERVIÇO']);
            const total = getVal(['Total', 'VALOR', 'preco_total', 'TOTAL GERAL']);
            
            // Skip "TOTAL CONSOLIDADO" or empty lines
            if (peca.toUpperCase().includes('TOTAL') || (!peca && !total)) return null;

            return {
              moto: getVal(['Veículo', 'PLACA', 'moto', 'MOTO', 'MODELO']) || '',
              peca: peca,
              codigo: getVal(['codigo', 'CÓDIGO', 'ID']) || '',
              quantidade: getVal(['Qtd', 'QUANT', 'quantidade', 'ITENS']) || '1',
              preco_unitario: getVal(['Unitário', 'Unitario', 'preco_unitario']) || '0',
              preco_total: total || '0',
              fornecedor: getVal(['Fornecedor', 'fornecedor', 'MARCA']) || '',
              data: getVal(['Data', 'DATA', 'data']) || '',
              os: getVal(['OS ID', 'OS', 'os']) || '',
              km: getVal(['km', 'KM']) || '',
              arquivo_pdf: 'Importado de Excel',
              placa: getVal(['PLACA', 'placa']) || '',
              marca: getVal(['MARCA', 'marca']) || '',
              modelo: getVal(['MODELO', 'modelo']) || '',
              observacao: getVal(['observacao', 'OBSERVAÇÃO', 'OBS']) || '',
              pagina: '1',
              total_produtos: getVal(['TOTAL PRODUTOS', 'total_produtos']) || '',
              total_servicos: getVal(['TOTAL SERVIÇOS', 'total_servicos']) || '',
              total_geral: total
            } as ExtractedRow;
          }).filter(Boolean) as ExtractedRow[];

          allImportedRows = [...allImportedRows, ...mappedRows];
        });

        if (allImportedRows.length > 0) {
          setExtractedData(prev => {
            // Avoid duplicates by plate and piece name if possible, or just append
            return [...prev, ...allImportedRows];
          });
          setCurrentStep('view');
          alert(`${allImportedRows.length} registros sincronizados do Excel.`);
        } else {
          alert("Nenhuma informação válida encontrada no arquivo.");
        }
      } catch (error) {
        console.error("Erro ao importar Excel:", error);
        alert("Erro técnico ao ler o Excel. Certifique-se de que é um arquivo .xlsx válido.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const deleteRow = async (rowToDelete: ExtractedRow) => {
    if (!window.confirm("Tem certeza que deseja excluir esta linha permanentemente?")) return;

    if (rowToDelete.id && supabase) {
      try {
        const { error } = await supabase
          .from('extracted_data')
          .delete()
          .eq('id', rowToDelete.id);
        
        if (error) throw error;
      } catch (error) {
        console.error("Erro ao excluir do Supabase:", error);
        alert("Erro ao excluir do banco de dados.");
        return;
      }
    }

    setExtractedData(prev => prev.filter(r => r !== rowToDelete));
  };

  const processPDFs = async () => {
    if (files.length === 0) return;
    
    if (dbStatus !== 'connected' && supabase) {
      if (!window.confirm("O banco de dados não parece estar conectado corretamente. Deseja processar apenas localmente? (Os dados não serão salvos na nuvem)")) {
        return;
      }
    }

    setIsProcessing(true);
    
    const allRows: ExtractedRow[] = [];
    const allSummaries: DocumentSummary[] = [];

    try {
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFJS.getDocument({ data: arrayBuffer }).promise;
        
        let docRows: ExtractedRow[] = [];
        const docSummary: DocumentSummary = {
          arquivo_pdf: file.name,
          placa: "",
          marca: "",
          modelo: "",
          moto: "",
          data: "",
          os: "",
          km: "",
          observacao: "",
          fornecedor: "",
          total_produtos: "",
          total_servicos: "",
          total_geral: "",
          itens_extraidos: 0,
        };

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Construct text line by line - this is a simplification of pdfplumber's layout extraction
          // In web we often get items out of order, so let's try to sort them roughly by transform
          const items = textContent.items as any[];
          const lines: string[] = [];
          
          // Group by Y coordinate (approximate)
          const yGroups: { [key: number]: any[] } = {};
          items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!yGroups[y]) yGroups[y] = [];
            yGroups[y].push(item);
          });

          // Sort Y keys descending (top to bottom)
          const sortedY = Object.keys(yGroups).map(Number).sort((a, b) => b - a);
          sortedY.forEach(y => {
            const lineItems = yGroups[y].sort((a, b) => a.transform[4] - b.transform[4]);
            lines.push(lineItems.map(it => it.str).join(" "));
          });

          const pageText = lines.join("\n");
          const { rows, summary } = extractDataFromText(pageText, file.name, i);
          
          docRows = [...docRows, ...rows];
          
          // Merge summary data from pages (first occurrence usually)
          Object.keys(summary).forEach((key) => {
             const k = key as keyof DocumentSummary;
             if (summary[k] && !docSummary[k]) {
               (docSummary as any)[k] = summary[k];
             }
          });
        }

        docSummary.itens_extraidos = docRows.length;
        if (!docSummary.moto && docSummary.placa) {
          docSummary.moto = docSummary.placa;
        }

        // Apply summary data to all rows for this doc
          const finalizedRows = docRows.map(row => {
            const getValid = (primary: string | undefined, secondary: string | undefined) => {
              if (primary && primary.trim() !== '' && primary !== 'N/A' && primary !== '0') return primary;
              return secondary || '';
            };

            return {
              ...row,
              placa: getValid(docSummary.placa, row.placa),
              marca: getValid(docSummary.marca, row.marca),
              modelo: getValid(docSummary.modelo, row.modelo),
              moto: getValid(docSummary.moto, row.moto),
              data: getValid(docSummary.data, row.data),
              os: getValid(docSummary.os, row.os),
              km: getValid(docSummary.km, row.km),
              observacao: getValid(docSummary.observacao, row.observacao),
              fornecedor: getValid(docSummary.fornecedor, row.fornecedor),
              total_produtos: getValid(docSummary.total_produtos, row.total_produtos),
              total_servicos: getValid(docSummary.total_servicos, row.total_servicos),
              total_geral: getValid(docSummary.total_geral, row.total_geral),
            };
          });

        allRows.push(...finalizedRows);
        allSummaries.push(docSummary);
      }

      setExtractedData(allRows);
      setSummaries(allSummaries);
      
      // Automatic save to Supabase
      if (allRows.length > 0 && supabase) {
        setIsSaving(true);
        try {
          // Fetch once to ensure we have the latest state for comparison
          await fetchFromSupabase();

          // Smart Filtering: Only save rows that don't already exist in the database
          // We use local state (which was just refreshed) to determine what exists
          const newRowsToSave = allRows.filter(row => {
            const isDuplicate = extractedData.some(existing => 
               normalizePlate(existing.placa) === normalizePlate(row.placa) &&
               existing.data === row.data &&
               existing.os === row.os &&
               existing.codigo === row.codigo &&
               existing.peca === row.peca
            );
            return !isDuplicate;
          });

          if (newRowsToSave.length > 0) {
            const rowsToInsert = newRowsToSave.map(d => ({
              moto: d.moto,
              peca: d.peca,
              codigo: d.codigo,
              quantidade: d.quantidade,
              preco_unitario: d.preco_unitario,
              preco_total: d.preco_total,
              fornecedor: d.fornecedor,
              data: d.data,
              os: d.os,
              km: d.km,
              arquivo_pdf: d.arquivo_pdf,
              placa: d.placa,
              marca: d.marca,
              modelo: d.modelo,
              observacao: d.observacao,
              pagina: d.pagina,
              total_produtos: d.total_produtos,
              total_servicos: d.total_servicos,
              total_geral: d.total_geral
            }));

            const { error } = await supabase
              .from('extracted_data')
              .insert(rowsToInsert);

            if (error) throw error;
            
            await fetchFromSupabase();
            alert(`✓ ${newRowsToSave.length} novos itens salvos na nuvem Cedro. ${allRows.length - newRowsToSave.length} duplicatas foram ignoradas.`);
          } else {
            alert("Informação: Todos os itens detectados já constam na Base de Dados.");
          }
          
          // CRITICAL: Clean up current session so the UI only shows consolidated database data
          setFiles([]);
          setSummaries([]);
          // We don't need to manually clear allRows or setExtractedData(allRows) 
          // because fetchFromSupabase() will populate the UI with the final state.
          
        } catch (err) {
          console.error("Erro no salvamento:", err);
          alert("Erro ao salvar no banco. Verifique se a configuração está correta.");
        } finally {
          setIsSaving(false);
        }
      }

      setCurrentStep('view');
    } catch (error) {
      console.error("Error parsing PDFs:", error);
      alert("Erro ao processar os PDFs. Verifique se os arquivos são válidos.");
    } finally {
      setIsProcessing(false);
    }
  };

  const extractDataFromText = (text: string, fileName: string, pageNo: number) => {
    const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(l => l);
    
    const summary: Partial<DocumentSummary> = {
      fornecedor: lines[0]?.replace(/\s+Laudo$/i, "") || ""
    };

    const dates = Array.from(text.matchAll(new RegExp(DATE_REGEX, "g"))).map(m => m[1]);
    if (dates.length > 0) {
      summary.data = dates[1] || dates[0];
    }

    // OS identification
    for (const line of lines.slice(0, 15)) {
      if (/^\d{7,10}$/.test(line)) {
        summary.os = line.replace(/^0+/, "") || line;
        break;
      }
    }

    // Vehicle info parsing (flexible)
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const norm = normalizeText(line);
      
      // Look for Plate
      const plateMatch = line.match(/\b([A-Z]{3}-?[0-9][A-Z0-9][0-9]{2})\b/i);
      if (plateMatch && !summary.placa) {
        summary.placa = plateMatch[1].toUpperCase().replace("-", "").replace(/\s+/g, "");
      }

      // Look for Brand/Model - Check if the line contains vehicle info
      if ((norm.includes("placa") || norm.includes("marca") || norm.includes("modelo")) && idx + 1 < lines.length) {
        const nextLine = lines[idx + 1];
        const nextNorm = normalizeText(nextLine);
        
        // Skip header lines that might follow
        if (!nextNorm.includes("chassi") && !nextNorm.includes("kilometragem")) {
           // Try to extract brand and model if we haven't yet
           if (!summary.marca) {
             const brandMatch = nextLine.match(/\b(HONDA|YAMAHA|SUZUKI|DAFRA|BMW|KAWASAKI|SHINERAY|VOLKSWAGEN|FIAT|FORD|CHEVROLET|TOYOTA|HYUNDAI|RENAULT)\b/i);
             if (brandMatch) summary.marca = brandMatch[1].toUpperCase();
           }
        }
      }

      if (norm.includes("placa chassi montadora modelo") && idx + 1 < lines.length) {
        const combined = lines[idx + 1];
        // More loose regex for KM and Brand/Model
        const match = combined.match(/(?:(?:KM|KM:)[-\s]*(\d+))?\s*([A-Z]{2,})\s+(.+)$/i);
        if (match) {
          if (match[1]) summary.km = match[1];
          if (!summary.marca) summary.marca = match[2].toUpperCase();
          if (!summary.modelo) summary.modelo = match[3].trim();
        }
      } 
      
      // Fallback searches
      if (!summary.km && (norm.includes("km") || norm.includes("kilometragem"))) {
        const kms = line.match(/\b(\d+)\b/);
        if (kms && kms[1].length >= 1) summary.km = kms[1];
      }

      if (norm === "observacoes" && idx + 1 < lines.length) {
        const obs = lines[idx + 1].trim();
        if (!normalizeText(obs).includes("avarias") && !normalizeText(obs).includes("produtos")) {
          summary.observacao = obs;
        }
      }
    }

    // Fallback: search for explicit labels like "Modelo: [Name]"
    if (!summary.modelo) {
      for (const line of lines.slice(0, 20)) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes("modelo:")) {
          const parts = line.split(/modelo:/i);
          if (parts.length > 1) {
            summary.modelo = parts[1].trim().split(/\s{2,}/)[0]; // Take only until next large space
            break;
          }
        }
      }
    }

    if (summary.placa || summary.modelo) {
      summary.moto = [summary.placa, summary.modelo].filter(Boolean).join(" ");
    }

    // Totals
    const moneyMatches = Array.from(text.matchAll(MONEY_IN_TEXT_REGEX)).map(m => parseMoney(m[1]));
    if (moneyMatches.length >= 3) {
      summary.total_produtos = moneyMatches[moneyMatches.length - 3];
      summary.total_servicos = moneyMatches[moneyMatches.length - 2];
      summary.total_geral = moneyMatches[moneyMatches.length - 1];
    }

    // Items line parsing
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const n = normalizeText(lines[i]);
        if (n === "codigo produto preco quantidade total geral" || n.includes("produtos e servicos")) {
            startIdx = i + (n.includes("produtos e servicos") ? 2 : 1);
            break;
        }
    }

    const rows: ExtractedRow[] = [];
    if (startIdx !== -1) {
      let currentItem: Partial<ExtractedRow> | null = null;
      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        const norm = normalizeText(line);
        if (!line || norm === "produtos") continue;
        if (norm.startsWith("total produtos") || norm.startsWith("total servicos") || norm.startsWith("total geral") || norm.startsWith("eu,") || norm.includes("autorizo o conserto") || norm.startsWith("pagina")) break;
        if (normalizeText(summary.fornecedor || "") === norm) break;

        const itemMatch = line.match(ITEM_LINE_REGEX);
        if (itemMatch) {
          if (currentItem) {
            currentItem.peca = cleanupProductName(currentItem.peca || "");
            rows.push(currentItem as ExtractedRow);
          }
          currentItem = {
            moto: summary.moto || "",
            peca: itemMatch[2],
            codigo: itemMatch[1],
            quantidade: cleanNumeric(itemMatch[4]),
            preco_unitario: parseMoney(itemMatch[3]),
            preco_total: parseMoney(itemMatch[5]),
            fornecedor: summary.fornecedor || "",
            data: summary.data || "",
            observacao: summary.observacao || "",
            arquivo_pdf: fileName,
            pagina: String(pageNo)
          };
          continue;
        }

        if (currentItem) {
          if (!line.match(ORDER_NO_REGEX) && !norm.startsWith("r$")) {
            currentItem.peca = (currentItem.peca || "") + " " + line;
          }
        }
      }
      if (currentItem) {
        currentItem.peca = cleanupProductName(currentItem.peca || "");
        rows.push(currentItem as ExtractedRow);
      }
    }

    return { rows, summary };
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const COLORS = {
      DARK_GREEN: '075618',
      LIGHT_GREEN: 'F3F7F2',
      ORANGE: 'F29222',
      WHITE: 'FFFFFF',
      BORDER: '075618'
    };

    const headerStyle = {
      fill: { fgColor: { rgb: COLORS.DARK_GREEN } },
      font: { color: { rgb: COLORS.WHITE }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: COLORS.BORDER } },
        bottom: { style: 'thin', color: { rgb: COLORS.BORDER } },
        left: { style: 'thin', color: { rgb: COLORS.BORDER } },
        right: { style: 'thin', color: { rgb: COLORS.BORDER } }
      }
    };

    const cellStyle = {
      alignment: { vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: COLORS.BORDER } },
        bottom: { style: 'thin', color: { rgb: COLORS.BORDER } },
        left: { style: 'thin', color: { rgb: COLORS.BORDER } },
        right: { style: 'thin', color: { rgb: COLORS.BORDER } }
      }
    };

    const totalStyle = {
      fill: { fgColor: { rgb: COLORS.ORANGE } },
      font: { color: { rgb: COLORS.WHITE }, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: COLORS.BORDER } },
        bottom: { style: 'thin', color: { rgb: COLORS.BORDER } },
        left: { style: 'thin', color: { rgb: COLORS.BORDER } },
        right: { style: 'thin', color: { rgb: COLORS.BORDER } }
      }
    };

    // Summary Sheet
    const summaryData: any[][] = [
      [{ v: 'RELATÓRIO GERAL - PEÇAS EXTRAÍDAS', s: { 
        ...headerStyle, 
        font: { ...headerStyle.font, sz: 14 }
      } }],
      [], // Empty row
      [
        { v: 'PLACA', s: headerStyle },
        { v: 'MARCA', s: headerStyle },
        { v: 'MODELO', s: headerStyle },
        { v: 'DATA', s: headerStyle },
        { v: 'OS', s: headerStyle },
        { v: 'KM', s: headerStyle },
        { v: 'ITENS', s: headerStyle },
        { v: 'TOTAL PRODUTOS', s: headerStyle },
        { v: 'TOTAL SERVIÇOS', s: headerStyle },
        { v: 'TOTAL GERAL', s: headerStyle },
        { v: 'ARQUIVO PDF', s: headerStyle }
      ]
    ];

    // Compute summaries for filtered data
    const uniqueDocs = Array.from(new Set(filteredData.map(d => d.arquivo_pdf)));
    const exportSummaries = uniqueDocs.map(pdf => {
      const docRows = filteredData.filter(d => d.arquivo_pdf === pdf);
      const first = docRows[0];
      return {
        arquivo_pdf: pdf,
        placa: first.placa,
        marca: first.marca,
        modelo: first.modelo,
        data: first.data,
        os: first.os,
        km: first.km,
        total_produtos: first.total_produtos,
        total_servicos: first.total_servicos,
        total_geral: first.total_geral,
        itens_extraidos: docRows.length
      };
    });

    exportSummaries.forEach(s => {
      summaryData.push([
        { v: normalizePlate(s.placa) || '', s: cellStyle },
        { v: s.marca || '', s: cellStyle },
        { v: s.modelo || '', s: cellStyle },
        { v: s.data || '', s: cellStyle },
        { v: s.os || '', s: cellStyle },
        { v: s.km || '', s: cellStyle },
        { v: s.itens_extraidos || 0, s: { ...cellStyle, alignment: { horizontal: 'center' } } },
        { v: parseFloat(s.total_produtos || '0'), s: { ...cellStyle, alignment: { horizontal: 'right' }, numFmt: '"R$ "#,##0.00' } },
        { v: parseFloat(s.total_servicos || '0'), s: { ...cellStyle, alignment: { horizontal: 'right' }, numFmt: '"R$ "#,##0.00' } },
        { v: parseFloat(s.total_geral || '0'), s: { ...cellStyle, alignment: { horizontal: 'right' }, numFmt: '"R$ "#,##0.00' } },
        { v: s.arquivo_pdf || '', s: cellStyle }
      ]);
    });

    // Add Total Consolidado
    const totalGeralConsolidado = exportSummaries.reduce((acc, s) => acc + parseFloat(s.total_geral || '0'), 0);
    summaryData.push([]); // Gap
    summaryData.push([
      { v: 'TOTAL CONSOLIDADO', s: totalStyle },
      '', '', '', '', '', '', '', '', 
      { v: totalGeralConsolidado, s: { ...totalStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: 'right' } } }
    ]);

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Relatório title merge
      { s: { r: summaryData.length - 1, c: 0 }, e: { r: summaryData.length - 1, c: 7 } } // Total label merge
    ];
    summaryWs['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, 
      { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, summaryWs, "RESUMO GERAL");

    // Vehicles are processed individually
    const rowsByPlate: { [key: string]: ExtractedRow[] } = {};
    
    // Determine which data to export: all or filtered
    const dataToExport = filteredData;

    dataToExport.forEach(row => {
      const plateKey = normalizePlate(row.placa) || normalizePlate(row.moto) || "SEM_PLACA";
      if (!rowsByPlate[plateKey]) rowsByPlate[plateKey] = [];
      rowsByPlate[plateKey].push(row);
    });

    Object.entries(rowsByPlate).forEach(([plate, rows]) => {
      const plateSheetData: any[][] = [
        [{ v: 'CONTROLE DE FORNECIMENTO - ' + plate, s: { ...headerStyle, font: { ...headerStyle.font, sz: 14 } } }],
        [{ v: 'Planilha gerada automaticamente via PDF Analyzer', s: { 
          alignment: { horizontal: 'center' }, 
          font: { italic: true, color: { rgb: '666666' } } 
        } }],
        [],
        [
          { v: 'PLACA', s: headerStyle },
          { v: 'MARCA', s: headerStyle },
          { v: 'DATA', s: headerStyle },
          { v: 'OS', s: headerStyle },
          { v: 'KM', s: headerStyle },
          { v: 'PEÇA / SERVIÇO', s: headerStyle },
          { v: 'QUANT', s: headerStyle },
          { v: 'VALOR', s: headerStyle }
        ]
      ];

      rows.forEach(r => {
        plateSheetData.push([
          { v: normalizePlate(r.placa), s: cellStyle },
          { v: r.marca, s: cellStyle },
          { v: r.data, s: cellStyle },
          { v: r.os, s: cellStyle },
          { v: r.km, s: cellStyle },
          { v: cleanupProductName(r.peca), s: cellStyle },
          { v: parseFloat(r.quantidade || '1'), s: { ...cellStyle, alignment: { horizontal: 'center' } } },
          { v: parseFloat(r.preco_total || r.preco_unitario || '0'), s: { ...cellStyle, alignment: { horizontal: 'right' }, numFmt: '"R$ "#,##0.00' } },
        ]);
      });

      const plateTotal = rows.reduce((acc, r) => acc + parseFloat(r.preco_total || r.preco_unitario || '0'), 0);
      plateSheetData.push([]);
      plateSheetData.push([
        { v: 'TOTAL DA PLACA', s: totalStyle },
        '', '', '', '', '', '',
        { v: plateTotal, s: { ...totalStyle, numFmt: '"R$ "#,##0.00', alignment: { horizontal: 'right' } } }
      ]);

      const ws = XLSX.utils.aoa_to_sheet(plateSheetData);
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
        { s: { r: plateSheetData.length - 1, c: 0 }, e: { r: plateSheetData.length - 1, c: 6 } }
      ];
      ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 45 }, { wch: 8 }, { wch: 15 }];
      
      const safeName = plate.substring(0, 31).replace(/[\\/?*[\]]/g, "-");
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    XLSX.writeFile(wb, "Relatorio_Pecas_Fan_Motos.xlsx");
  };

  const saveToSupabase = async () => {
    if (!supabase) {
      alert("Configurações do Supabase não encontradas. Verifique o arquivo .env");
      return;
    }
    if (extractedData.length === 0) return;

    setIsSaving(true);
    try {
      // Use upsert to update existing rows and insert new ones
      const { data, error } = await supabase
        .from('extracted_data')
        .upsert(extractedData.map(d => ({
          ...(d.id ? { id: d.id } : {}), // Keep ID if it exists for updates
          moto: d.moto,
          peca: d.peca,
          codigo: d.codigo,
          quantidade: d.quantidade,
          preco_unitario: d.preco_unitario,
          preco_total: d.preco_total,
          fornecedor: d.fornecedor,
          data: d.data,
          os: d.os,
          km: d.km,
          arquivo_pdf: d.arquivo_pdf,
          placa: d.placa,
          marca: d.marca,
          modelo: d.modelo,
          observacao: d.observacao,
          pagina: d.pagina,
          total_produtos: d.total_produtos,
          total_servicos: d.total_servicos,
          total_geral: d.total_geral
        })))
        .select();

      if (error) throw error;
      
      // Update local state with returned data (to get IDs for newly created rows)
      if (data) {
        setExtractedData(data);
      }
      
      alert("Configurações sincronizadas com o banco Cedro!");
    } catch (error) {
      console.error("Erro ao salvar no Supabase:", error);
      alert("Erro ao salvar os dados. Verifique a estrutura da sua tabela ou conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = extractedData;
    
    // Search query filter
    if (searchQuery) {
      const q = normalizeText(searchQuery);
      result = result.filter(row => 
        normalizeText(row.moto || "").includes(q) ||
        normalizeText(row.peca || "").includes(q) ||
        normalizeText(row.codigo || "").includes(q) ||
        normalizeText(row.fornecedor || "").includes(q) ||
        normalizeText(row.os || "").includes(q) ||
        normalizeText(row.placa || "").includes(q)
      );
    }

    // Plate/Vehicle filter
    if (filterPlate) {
      const p = normalizeText(filterPlate);
      result = result.filter(row => 
        normalizePlate(row.placa || "").includes(normalizePlate(filterPlate)) ||
        normalizeText(row.modelo || "").includes(p) ||
        normalizeText(row.marca || "").includes(p)
      );
    }

    // Date range filter
    if (filterStartDate || filterEndDate) {
      result = result.filter(row => {
        if (!row.data) return false;
        // Parse dd/mm/yyyy to Date object
        const parts = row.data.split('/');
        if (parts.length !== 3) return false;
        const rowDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          if (rowDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          if (rowDate > end) return false;
        }
        return true;
      });
    }

    return result;
  }, [extractedData, searchQuery, filterPlate, filterStartDate, filterEndDate]);

  // --- DASHBOARD DATA PROCESSING ---
  const dashboardData = useMemo(() => {
    if (extractedData.length === 0) return null;

    // 1. Total Spending
    const totalSpending = extractedData.reduce((acc, row) => acc + parseFloat(row.preco_total || '0'), 0);

    // 2. Monthly Spending
    const monthlyMap: { [key: string]: number } = {};
    extractedData.forEach(row => {
      if (!row.data) return;
      const parts = row.data.split('/');
      if (parts.length === 3) {
        const monthYear = `${parts[1]}/${parts[2]}`;
        monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + parseFloat(row.preco_total || '0');
      }
    });
    const monthlySpending = Object.entries(monthlyMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => {
        const [m1, y1] = a.name.split('/').map(Number);
        const [m2, y2] = b.name.split('/').map(Number);
        return y1 !== y2 ? y1 - y2 : m1 - m2;
      });

    // 3. Top Pieces (Most Bought by Quantity)
    const piecesMap: { [key: string]: { qty: number, total: number } } = {};
    extractedData.forEach(row => {
      const name = cleanupProductName(row.peca).toUpperCase();
      if (!name || name === "MAO DE OBRA") return;
      if (!piecesMap[name]) piecesMap[name] = { qty: 0, total: 0 };
      piecesMap[name].qty += parseFloat(row.quantidade || '0');
      piecesMap[name].total += parseFloat(row.preco_total || '0');
    });
    const topPieces = Object.entries(piecesMap)
      .map(([name, data]) => ({ name, value: data.qty, total: data.total }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // 4. Maintenance Types (Categories based on keywords)
    const maintenanceMap: { [key: string]: number } = {
      'Motor': 0,
      'Pneus': 0,
      'Óleos/Fluidos': 0,
      'Freios': 0,
      'Elétrica': 0,
      'Outros': 0
    };
    extractedData.forEach(row => {
      const p = normalizeText(row.peca);
      const val = parseFloat(row.preco_total || '0');
      if (p.includes('pneu') || p.includes('camera')) maintenanceMap['Pneus'] += val;
      else if (p.includes('oleo') || p.includes('fluido') || p.includes('lubrif')) maintenanceMap['Óleos/Fluidos'] += val;
      else if (p.includes('freio') || p.includes('pastilha') || p.includes('disco')) maintenanceMap['Freios'] += val;
      else if (p.includes('lampada') || p.includes('bateria') || p.includes('vela')) maintenanceMap['Elétrica'] += val;
      else if (p.includes('motor') || p.includes('pistao') || p.includes('valvula')) maintenanceMap['Motor'] += val;
      else maintenanceMap['Outros'] += val;
    });
    const maintenanceData = Object.entries(maintenanceMap)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);

    // 5. Brands Spending
    const brandsMap: { [key: string]: number } = {};
    extractedData.forEach(row => {
      const brand = row.marca || "OUTROS";
      brandsMap[brand] = (brandsMap[brand] || 0) + parseFloat(row.preco_total || '0');
    });
    const brandsData = Object.entries(brandsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 6. Models Spending (Top 5 Models by total cost)
    const modelsMap: { [key: string]: number } = {};
    extractedData.forEach(row => {
      if (!row.modelo || row.modelo === "EMPTY") return;
      const modelName = row.modelo.toUpperCase();
      modelsMap[modelName] = (modelsMap[modelName] || 0) + parseFloat(row.preco_total || '0');
    });
    const modelsData = Object.entries(modelsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalSpending,
      monthlySpending,
      topPieces,
      maintenanceData,
      brandsData,
      modelsData,
      countOS: new Set(extractedData.filter(d => d.os).map(d => d.os)).size,
      countItems: extractedData.length
    };
  }, [extractedData]);

  const exportAllSupabaseData = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('extracted_data')
        .select('*');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        alert("Sem dados no banco para exportar.");
        return;
      }
      
      // Temporary state override just for export
      const originalFiltered = filteredData;
      const originalData = extractedData;
      
      // Perform export with all data
      setExtractedData(data);
      // Wait for React to sync state if needed, but since we call it here:
      setTimeout(() => {
        exportExcel();
        setExtractedData(originalData); // Restore
      }, 100);

    } catch (err) {
      console.error("Erro ao exportar tudo:", err);
      alert("Erro ao baixar dados do banco.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-text-main font-sans selection:bg-brand-primary/10">
      {/* Header */}
      <header className="border-b border-border bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro Logo" 
              className="h-12 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentStep('upload')}
                className={cn(
                  "text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-widest px-4 py-2 rounded-lg",
                  currentStep === 'upload' ? "bg-brand-primary/10 text-brand-primary" : "text-text-muted hover:text-brand-primary"
                )}
              >
                <Plus size={16} /> Novo Lote
              </button>
              <button 
                onClick={() => setCurrentStep('view')}
                className={cn(
                  "text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-widest px-4 py-2 rounded-lg",
                  currentStep === 'view' ? "bg-brand-primary/10 text-brand-primary" : "text-text-muted hover:text-brand-primary"
                )}
              >
                <Database size={16} /> Base de Dados
              </button>
              <button 
                onClick={() => setCurrentStep('dashboard')}
                className={cn(
                  "text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-widest px-4 py-2 rounded-lg",
                  currentStep === 'dashboard' ? "bg-brand-primary/10 text-brand-primary" : "text-text-muted hover:text-brand-primary"
                )}
              >
                <BarChart2 size={16} /> Dashboard
              </button>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-3">
              {dbStatus === 'connected' ? (
                <div className="hidden lg:flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 mr-2">
                  <Cloud size={14} className="text-brand-primary" />
                  <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest leading-none">Nuvem Sincronizada</span>
                </div>
              ) : dbStatus === 'error' ? (
                <button 
                  onClick={() => setSupabaseError(true)}
                  className="hidden lg:flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 mr-2 animate-pulse"
                >
                  <AlertCircle size={14} className="text-red-500" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">Erro na Nuvem</span>
                </button>
              ) : (
                <button 
                  onClick={() => setConfigError(true)}
                  className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 mr-2 hover:bg-slate-100 transition-colors"
                >
                  <Cloud size={14} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Offline</span>
                </button>
              )}

              <div className="w-10 h-10 rounded-full border-2 border-brand-primary p-0.5 bg-white">
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-brand-primary">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-black text-text-main uppercase leading-none">Usuário Cedro</span>
                <span className="text-[9px] text-brand-primary font-bold uppercase tracking-tighter">Conectado com Segurança</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Subtle Database Alert */}
        <AnimatePresence>
          {configError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="p-6 bg-orange-50 border-2 border-orange-100 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                    <Cloud size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-orange-700 uppercase tracking-widest text-xs">Variáveis de Ambiente Ausentes</h3>
                    <p className="text-[11px] text-orange-600 font-bold opacity-80">As chaves do Supabase não foram encontradas. No Netlify, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const msg = `Para funcionar no Netlify:\n1. Vá em Site Settings > Environment variables\n2. Adicione:\n   VITE_SUPABASE_URL: Seu URL\n   VITE_SUPABASE_ANON_KEY: Sua chave anon`;
                      alert(msg);
                    }}
                    className="bg-orange-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-orange-700 transition-all uppercase tracking-widest"
                  >
                    COMO CONFIGURAR
                  </button>
                  <button 
                    onClick={() => setConfigError(false)}
                    className="bg-white text-orange-600 border border-orange-200 px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-orange-50 transition-all uppercase tracking-widest"
                  >
                    OCULTAR
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {supabaseError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <div className="p-6 bg-red-50 border-2 border-red-100 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                    <Database size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-red-700 uppercase tracking-widest text-xs">Sincronização Interrompida</h3>
                    <p className="text-[11px] text-red-600 font-bold opacity-80">A tabela 'extracted_data' não foi encontrada. Clique no botão ao lado para copiar o SQL de reparo.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      const sql = `CREATE TABLE IF NOT EXISTS public.extracted_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  moto text,
  peca text,
  codigo text,
  quantidade text,
  preco_unitario text,
  preco_total text,
  fornecedor text,
  data text,
  os text,
  km text,
  arquivo_pdf text,
  placa text,
  marca text,
  modelo text,
  observacao text,
  pagina text,
  total_produtos text,
  total_servicos text,
  total_geral text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.extracted_data ENABLE ROW LEVEL SECURITY;

-- Constraint de Unicidade para evitar duplicatas (Placa + Data + OS + Código + Peça)
ALTER TABLE public.extracted_data DROP CONSTRAINT IF EXISTS unique_entry_constraint;
ALTER TABLE public.extracted_data ADD CONSTRAINT unique_entry_constraint UNIQUE (placa, data, os, codigo, peca);

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'extracted_data' AND policyname = 'Permitir tudo para anon'
    ) THEN
        CREATE POLICY "Permitir tudo para anon" ON public.extracted_data FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';`;
                      navigator.clipboard.writeText(sql);
                      alert("SQL Copiado! Cole no SQL Editor do Supabase.");
                    }}
                    className="bg-red-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-red-700 transition-all uppercase tracking-widest"
                  >
                    COPIAR SQL DE REPARO
                  </button>
                  <button 
                    onClick={() => {
                      setSupabaseError(false);
                      checkConnection();
                    }}
                    className="bg-white border border-red-200 text-red-600 px-5 py-2.5 rounded-xl text-[10px] font-black hover:bg-red-50 transition-all uppercase tracking-widest"
                  >
                    IGNORAR
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {currentStep === 'upload' ? (
            <motion.div 
              key="upload-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="flex flex-col gap-3 text-center max-w-3xl mx-auto">

                <h2 className="text-4xl font-black text-text-main">Converta PDF para Excel agora mesmo</h2>
                <p className="text-text-muted text-lg font-medium opacity-80 leading-relaxed italic">
                  Arraste seus documentos para extração imediata de peças, quantidades e valores no formato oficial Cedro.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-8">
                  <div 
                    className={cn(
                      "group relative border-4 border-dashed rounded-[2.5rem] p-20 transition-all flex flex-col items-center justify-center gap-8 cursor-pointer overflow-hidden",
                      files.length > 0 ? "border-brand-primary/40 bg-green-50/20" : "border-border hover:border-brand-primary/40 hover:bg-green-50/10"
                    )}
                    id="dropzone"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    <div className="w-20 h-20 bg-white border-2 border-border rounded-2xl shadow-sm flex items-center justify-center text-text-muted group-hover:text-brand-primary group-hover:border-brand-primary transition-all group-hover:scale-110 duration-500">
                      <Upload size={32} />
                    </div>
                    <div className="text-center space-y-2">
                       <h3 className="text-2xl font-bold text-text-main">Arraste e solte seus PDFs</h3>
                       <p className="text-text-muted font-medium">Extraímos automaticamente Placas, OS e Valores</p>
                    </div>
                    <input 
                      id="file-input"
                      type="file" 
                      multiple 
                      accept=".pdf" 
                      className="hidden" 
                      onChange={onFileChange}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-xl shadow-slate-100">
                      <div className="px-8 py-5 border-b border-border flex justify-between items-center bg-slate-50/50">
                        <h4 className="text-xs font-black text-brand-primary uppercase tracking-widest">Documentos em Fila</h4>
                        <span className="text-xs font-black text-white bg-brand-primary px-3 py-1 rounded-full">
                          {files.length} {files.length === 1 ? 'ARQUIVO' : 'ARQUIVOS'}
                        </span>
                      </div>
                      <ul className="divide-y divide-border max-h-[400px] overflow-y-auto">
                        {files.map((file, idx) => (
                          <motion.li 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            key={`${file.name}-${idx}`} 
                            className="px-8 py-5 flex items-center justify-between hover:bg-green-50/10 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <FileText size={24} className="text-brand-primary" />
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-text-main truncate max-w-[400px] leading-tight">{file.name}</span>
                                <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest">{(file.size / 1024).toFixed(0)} KB • PDF</span>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                              className="text-slate-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <X size={20} />
                            </button>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className="bg-white border border-border p-8 rounded-[2rem] space-y-10 shadow-lg shadow-slate-50">
                    <div className="space-y-6">
                       <h4 className="text-xs font-black text-text-muted uppercase tracking-widest text-center">Processamento Cedro</h4>
                       <div className="space-y-4">
                         <div className="p-5 bg-green-50 border border-green-100 rounded-2xl">
                           <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Motor de Inteligência</p>
                           <p className="text-xs font-bold text-text-main mt-2 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                             Sistema Online & Seguro
                           </p>
                         </div>
                       </div>
                    </div>

                    <button 
                      onClick={processPDFs}
                      disabled={files.length === 0 || isProcessing || isSaving}
                      className={cn(
                        "w-full h-16 rounded-2xl text-base font-black transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/20",
                        files.length > 0 && !isProcessing && !isSaving
                          ? "bg-brand-primary text-white hover:scale-[1.02] active:scale-95" 
                          : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                      )}
                      id="btn-process"
                    >
                      {isProcessing || isSaving ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          {isSaving ? "SALVANDO NO BANCO..." : "EXTRAINDO..."}
                        </>
                      ) : (
                        <>
                          PROCESSAR AGORA
                          <CheckCircle2 size={24} />
                        </>
                      )}
                    </button>

                    <div className="p-6 border-2 border-dashed border-brand-accent/20 bg-brand-accent/5 rounded-2xl flex gap-4">
                      <AlertCircle className="text-brand-accent shrink-0" size={24} />
                      <p className="text-xs text-brand-accent font-bold leading-relaxed">
                        Atenção: Use PDFs com camadas de texto originais para garantir 100% de precisão nos valores.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : currentStep === 'dashboard' ? (
            <motion.div 
              key="dashboard-step"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-text-main">Gestão Estratégica</h2>
                </div>
                <div className="flex gap-4">
                   <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center min-w-[120px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ordens processadas</p>
                      <p className="text-2xl font-black text-brand-primary">{dashboardData?.countOS || 0}</p>
                   </div>
                   <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center min-w-[120px]">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Itens Extraídos</p>
                      <p className="text-2xl font-black text-brand-primary">{dashboardData?.countItems || 0}</p>
                   </div>
                   <div className="bg-brand-primary p-4 rounded-2xl text-center min-w-[160px] shadow-lg shadow-brand-primary/20">
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Investimento Total</p>
                      <p className="text-2xl font-black text-white">R$ {dashboardData?.totalSpending?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                   </div>
                </div>
              </div>

              {!dashboardData ? (
                <div className="py-20 text-center space-y-4 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <Database size={32} />
                   </div>
                   <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Aguardando dados para gerar o Dashboard estratégico...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Monthly Spending Chart */}
                  <div className="lg:col-span-8 bg-white border border-border p-8 rounded-[3rem] shadow-xl shadow-slate-100/50">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-lg font-black text-text-main flex items-center gap-3">
                        <TrendingUp className="text-brand-primary" /> Histórico de Gastos Mensais
                      </h3>
                      <div className="text-[10px] font-black text-brand-primary bg-green-50 px-3 py-1 rounded-full uppercase tracking-widest">Análise de Fluxo</div>
                    </div>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardData.monthlySpending}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#075618" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#075618" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                            tickFormatter={(val) => `R$${val}`}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                            formatter={(val: number) => [`R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Gasto Total']}
                          />
                          <Area type="monotone" dataKey="total" stroke="#075618" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Pieces / Most Bought */}
                  <div className="lg:col-span-4 bg-white border border-border p-8 rounded-[3rem] shadow-xl shadow-slate-100/50">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-lg font-black text-text-main flex items-center gap-3">
                         <BarChart2 className="text-brand-accent" /> Top Peças
                       </h3>
                    </div>
                    <div className="space-y-6">
                       {dashboardData.topPieces.map((piece, i) => (
                         <div key={i} className="space-y-2">
                            <div className="flex justify-between items-end">
                               <span className="text-[10px] font-black text-text-main truncate max-w-[200px] uppercase tracking-tight">{piece.name}</span>
                               <span className="text-[10px] font-black text-brand-primary">{piece.value} Unid.</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${(piece.value / dashboardData.topPieces[0].value) * 100}%` }}
                                 transition={{ delay: i * 0.1, duration: 1 }}
                                 className="h-full bg-brand-primary" 
                               />
                            </div>
                         </div>
                       ))}
                       <div className="pt-4 border-t border-dashed border-slate-200">
                          <p className="text-[10px] font-bold text-slate-400 italic">Analise as peças que mais necessitam de estoque baseado nas trocas frequentes.</p>
                       </div>
                    </div>
                  </div>

                  {/* Maintenance Type Category Chart */}
                  <div className="lg:col-span-6 bg-white border border-border p-8 rounded-[3rem] shadow-xl shadow-slate-100/50">
                    <h3 className="text-lg font-black text-text-main mb-8 flex items-center gap-3">
                       <PieChartIcon className="text-brand-primary" /> Manutenções por Categoria
                    </h3>
                    <div className="h-[300px] flex items-center">
                       <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                           <Pie
                             data={dashboardData.maintenanceData}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={100}
                             paddingAngle={5}
                             dataKey="value"
                           >
                             {dashboardData.maintenanceData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={['#075618', '#F29222', '#334155', '#10b981', '#6366f1', '#ec4899'][index % 6]} />
                             ))}
                           </Pie>
                           <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '11px' }}
                              formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`}
                           />
                           <Legend 
                              layout="vertical" 
                              verticalAlign="middle" 
                              align="right"
                              wrapperStyle={{ paddingLeft: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                           />
                         </PieChart>
                       </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Brands Distribution */}
                  <div className="lg:col-span-6 bg-white border border-border p-8 rounded-[3rem] shadow-xl shadow-slate-100/50">
                    <h3 className="text-lg font-black text-text-main mb-8 flex items-center gap-3">
                       <Activity className="text-brand-accent" /> Investimento por Fornecedor/Marca
                    </h3>
                    <div className="h-[300px]">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={dashboardData.brandsData} layout="vertical">
                           <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                           <XAxis type="number" hide />
                           <YAxis 
                             dataKey="name" 
                             type="category" 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fontSize: 9, fontWeight: 800, fill: '#1e293b' }} 
                             width={100}
                           />
                           <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', fontWeight: 800, fontSize: '11px' }}
                              formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`}
                           />
                           <Bar dataKey="value" fill="#F29222" radius={[0, 10, 10, 0]} barSize={20} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Models Distribution */}
                  <div className="lg:col-span-12 bg-white border border-border p-8 rounded-[3rem] shadow-xl shadow-slate-100/50">
                    <h3 className="text-lg font-black text-text-main mb-8 flex items-center gap-3">
                       <BarChart2 className="text-brand-primary" /> Top Modelos de Motos (Investimento Total)
                    </h3>
                    <div className="h-[300px]">
                       <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={dashboardData.modelsData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis 
                             dataKey="name" 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                           />
                           <YAxis 
                             axisLine={false} 
                             tickLine={false} 
                             tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                             tickFormatter={(val) => `R$${val}`}
                           />
                           <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: 800, fontSize: '12px' }}
                              formatter={(val: number) => `R$ ${val.toLocaleString('pt-BR')}`}
                           />
                           <Bar dataKey="value" fill="#075618" radius={[10, 10, 0, 0]} barSize={60} />
                         </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="view-step"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b-2 border-border mb-10">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 text-xs font-black text-brand-primary uppercase tracking-[0.2em] bg-green-50 px-3 py-1 rounded border border-green-100">
                    Base de Dados Cedro
                  </div>
                  <h2 className="text-4xl font-black text-text-main">
                    Histórico & Extrações
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      onChange={importBaseExcel}
                    />
                    <button 
                      className="h-12 px-6 bg-white border-2 border-brand-accent text-brand-accent text-xs font-black rounded-xl flex items-center gap-2 hover:bg-orange-50 transition-all shadow-lg shadow-slate-100 tracking-widest"
                    >
                      {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                      IMPORTAR EXCEL
                    </button>
                  </div>
                  <button 
                    onClick={fetchFromSupabase}
                    disabled={isLoading}
                    className="h-12 px-6 bg-white border-2 border-slate-300 text-slate-500 text-xs font-black rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all shadow-lg shadow-slate-100 disabled:opacity-50 tracking-widest"
                  >
                    <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    SINCRONIZAR
                  </button>
                  <button 
                    onClick={exportExcel}
                    className="h-12 px-8 bg-brand-accent text-white text-xs font-black rounded-xl flex items-center gap-2 hover:bg-[#d97f17] hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-accent/30 tracking-widest"
                    id="btn-export"
                  >
                    <Download size={18} />
                    EXPORTAR FILTRADOS (.XLSX)
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-border p-6 rounded-[2.5rem] mb-10">
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
                  <div className="md:col-span-2 lg:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                      <Search size={12} /> Busca Inteligente
                    </label>
                    <input 
                      type="text" 
                      placeholder="Pesquisar por peça, código, OS ou fornecedor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-12 px-6 bg-white border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all shadow-sm italic"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                      <Activity size={12} /> Placa/Moto
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: ABC1234"
                      value={filterPlate}
                      onChange={(e) => setFilterPlate(e.target.value)}
                      className="w-full h-12 px-6 bg-white border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                      <Calendar size={12} /> Início
                    </label>
                    <input 
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 flex items-center gap-2">
                      <Calendar size={12} /> Fim
                    </label>
                    <input 
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full h-12 px-4 bg-white border border-border rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="bg-brand-primary text-white p-6 rounded-[2rem] space-y-4 shadow-xl shadow-brand-primary/20">
                  <h3 className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Eficiência de Extração</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black">100</span>
                    <span className="text-white/40 text-sm mb-1.5 font-bold">%</span>
                  </div>
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="w-full h-full bg-brand-accent rounded-full" />
                  </div>
                </div>
                {summaries.slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-white border border-border p-6 rounded-[2rem] space-y-4 hover:border-brand-primary/40 transition-colors group">
                    <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] truncate group-hover:text-brand-primary transition-colors">{s.arquivo_pdf}</h3>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-text-muted font-black uppercase tracking-widest mb-1">Total Documento</p>
                        <p className="text-2xl font-black text-text-main leading-tight">R$ {s.total_geral || '0,00'}</p>
                      </div>
                      <span className="text-[10px] bg-brand-primary text-white px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-md shadow-brand-primary/10">
                        {s.itens_extraidos}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-border rounded-[2.5rem] shadow-xl shadow-slate-100/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-slate-50/50">
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary">Identificação Veículo</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary">Peça / Serviço Extraído</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary text-center">Data</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary text-center">Quant</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary text-right">Valor Total</th>
                        <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary text-center">Ordem Serviç.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredData.length > 0 ? filteredData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-green-50/10 group transition-all duration-300">
                          <td className="px-8 py-6">
                            <input 
                              type="text"
                              value={row.moto}
                              onChange={(e) => handleUpdateValue(row, 'moto', e.target.value)}
                              className="text-sm font-black text-text-main block bg-transparent border-none p-0 focus:ring-0 w-full"
                            />
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {row.marca && row.marca !== "EMPTY" && (
                                <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  {row.marca}
                                </span>
                              )}
                              {row.modelo && row.modelo !== "EMPTY" && (
                                <span className="text-[8px] font-black bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  {row.modelo}
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1.5 opacity-60">{row.fornecedor}</p>
                          </td>
                          <td className="px-8 py-6">
                            <input 
                              type="text"
                              value={row.peca}
                              onChange={(e) => handleUpdateValue(row, 'peca', e.target.value)}
                              className="text-xs text-text-muted font-medium leading-relaxed block w-full bg-transparent border-none p-0 focus:ring-0 italic"
                            />
                          </td>
                          <td className="px-8 py-6 text-center">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                              {row.data}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            <input 
                              type="text"
                              value={row.quantidade}
                              onChange={(e) => handleUpdateValue(row, 'quantidade', e.target.value)}
                              className="text-xs font-black text-text-main bg-slate-100 px-3 py-1.5 rounded-xl border border-border w-16 text-center focus:ring-2 focus:ring-brand-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-8 py-6 text-right">
                             <input 
                              type="text"
                              value={row.preco_total}
                              onChange={(e) => handleUpdateValue(row, 'preco_total', e.target.value)}
                              className="text-sm font-black text-brand-primary bg-transparent text-right border-none p-0 focus:ring-0 w-24"
                            />
                          </td>
                          <td className="px-8 py-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-[10px] font-black bg-white border-2 border-brand-accent/20 px-3 py-1.5 rounded-full text-brand-accent shadow-sm whitespace-nowrap">
                                ID {row.os}
                              </span>
                              <button 
                                onClick={() => deleteRow(row)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-8 py-32 text-center">
                            <div className="flex flex-col items-center gap-4">
                              <Search className="text-border" size={64} />
                              <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em]">Nenhum registro localizado</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Clean Modern Footer */}
      <footer className="max-w-7xl mx-auto px-8 py-12 mt-20 border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro Logo" 
              className="h-10 object-contain grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-col gap-1 text-center md:text-right">
            <div className="flex items-center justify-center md:justify-end gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
              <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Integridade Cedro Confirmada</span>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-loose">Laboratório Cedro Nit • 2026</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
