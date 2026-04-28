import { useState } from "react";
import "./App.css";

type Employee = {
  id: number;
  name: string;
  role: string;
  department: string;
  email: string;
};

export default function App() {
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: 1,
      name: "Maria Silva",
      role: "Analista de Laboratório",
      department: "Hematologia",
      email: "maria@labcedro.com.br",
    },
    {
      id: 2,
      name: "João Santos",
      role: "Assistente Administrativo",
      department: "Recepção",
      email: "joao@labcedro.com.br",
    },
  ]);

  function handleImport() {
    setIsImporting(true);

    setTimeout(() => {
      const newEmployee: Employee = {
        id: employees.length + 1,
        name: "Novo Colaborador",
        role: "Jovem Aprendiz",
        department: "Administrativo",
        email: "aprendiz@labcedro.com.br",
      };

      setEmployees((prev) => [...prev, newEmployee]);
      setIsImporting(false);
    }, 1000);
  }

  function handleLoad() {
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      alert("Dados carregados com sucesso!");
    }, 1000);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <section className="max-w-6xl mx-auto">
        <div className="mb-10">
          <span className="text-cyan-400 font-semibold uppercase tracking-widest">
            Laboratório Cedro
          </span>

          <h1 className="text-4xl md:text-5xl font-bold mt-3">
            Painel de Colaboradores
          </h1>

          <p className="text-slate-300 mt-4 max-w-2xl">
            Sistema interno para visualização, importação e gerenciamento de
            colaboradores.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-bold px-5 py-3 rounded-xl transition"
          >
            {isImporting ? "Importando..." : "Importar colaborador"}
          </button>

          <button
            onClick={handleLoad}
            disabled={isLoading}
            className="bg-white hover:bg-slate-200 disabled:opacity-60 text-slate-950 font-bold px-5 py-3 rounded-xl transition"
          >
            {isLoading ? "Carregando..." : "Carregar dados"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400">Total de colaboradores</p>
            <h2 className="text-3xl font-bold mt-2">{employees.length}</h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400">Departamentos</p>
            <h2 className="text-3xl font-bold mt-2">
              {new Set(employees.map((employee) => employee.department)).size}
            </h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-400">Status</p>
            <h2 className="text-3xl font-bold mt-2 text-cyan-400">Ativo</h2>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h2 className="text-xl font-bold">Lista de colaboradores</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="px-5 py-4">Nome</th>
                  <th className="px-5 py-4">Cargo</th>
                  <th className="px-5 py-4">Departamento</th>
                  <th className="px-5 py-4">E-mail</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-t border-slate-800 hover:bg-slate-800/60 transition"
                  >
                    <td className="px-5 py-4 font-medium">{employee.name}</td>
                    <td className="px-5 py-4 text-slate-300">
                      {employee.role}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {employee.department}
                    </td>
                    <td className="px-5 py-4 text-cyan-400">
                      {employee.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
