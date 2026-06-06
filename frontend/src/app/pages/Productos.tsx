import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Check,
  Package,
  Eye,
  Pencil,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { useState, useEffect, useRef } from "react";
import api from "../api/axiosInstance";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

export function Productos() {
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // Estados para modales
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [isViewCategoryOpen, setIsViewCategoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [viewingCategory, setViewingCategory] = useState<any>(null);

  // Estados para formularios
  const [newProductName, setNewProductName] = useState("Refresco Cola");
  const [newProductCategory, setNewProductCategory] = useState("2");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryProfit, setNewCategoryProfit] = useState("10");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  // Mensajes de error inline para los modales de categoría
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editCategoryError, setEditCategoryError] = useState<string | null>(null);
  // NUEVO: Estados para proveedor, presentación e imagen
  const [newProductProveedor, setNewProductProveedor] = useState("");
  const [newProductPresentacion, setNewProductPresentacion] = useState("");
  const [newProductImagen, setNewProductImagen] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);

  // Estados para alertas
  const [deleteAlert, setDeleteAlert] = useState<{
    isOpen: boolean;
    productId: number | null;
    productName: string;
    hasStock: boolean;
  }>({ isOpen: false, productId: null, productName: "", hasStock: false });

  const [deleteCategoryAlert, setDeleteCategoryAlert] = useState<{
    isOpen: boolean;
    categoryId: number | null;
    categoryName: string;
    hasProducts: boolean;
  }>({ isOpen: false, categoryId: null, categoryName: "", hasProducts: false });

  const [successMessage, setSuccessMessage] = useState(false);
  // MEJ-010: ref para limpiar el timer si el componente se desmonta
  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (successMessage) {
      successTimerRef.current = window.setTimeout(
        () => setSuccessMessage(false),
        3000,
      );
    }
    return () => {
      if (successTimerRef.current !== null) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, [successMessage]);

  const selectedCategoryData = categories.find(
    (cat) => cat.id === selectedCategory,
  );
  const filteredProducts = products.filter(
    (p) => p.categoryId === selectedCategory,
  );
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchCategory.toLowerCase()),
  );

  const fetchCategories = async () => {
    try {
      const response = await api.get("/catalogo/categorias/");
      const data = response.data.results ?? response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get("/catalogo/productos/");
      const data = response.data.results ?? response.data;
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchProveedores = async () => {
    try {
      const response = await api.get("/catalogo/proveedores/");
      const data = response.data.results ?? response.data;
      setProveedores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchProveedores();

    const handleBack = () => {
      setSelectedCategory(null);
    };

    window.addEventListener("popstate", handleBack);

    return () => {
      window.removeEventListener("popstate", handleBack);
    };
  }, []);

  const handleDeleteClick = (product: any) => {
    setDeleteAlert({
      isOpen: true,
      productId: product.id,
      productName: product.name,
      hasStock: product.stock > 0,
    });
  };

  const handleConfirmDelete = async () => {
    if (deleteAlert.productId) {
      try {
        await api.delete(`/catalogo/productos/${deleteAlert.productId}/`);
        setProducts(products.filter((p) => p.id !== deleteAlert.productId));
        setDeleteAlert({
          isOpen: false,
          productId: null,
          productName: "",
          hasStock: false,
        });
        setSuccessMessage(true); // el useEffect se encarga del timer
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  const handleEditClick = (product: any) => {
    setEditingProduct(product);
    setIsEditProductOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (isEdit) {
          setEditingProduct((prev: any) => ({ ...prev, imagen: base64String }));
        } else {
          setNewProductImagen(base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEdit = async () => {
    if (editingProduct) {
      try {
        const payload = {
          name: editingProduct.name,
          categoryId: parseInt(editingProduct.categoryId),
          proveedorId: editingProduct.proveedorId
            ? parseInt(editingProduct.proveedorId)
            : null,
          presentacion: editingProduct.presentacion,
          imagen: editingProduct.imagen || null,
        };
        const response = await api.patch(
          `/catalogo/productos/${editingProduct.id}/`,
          payload,
        );
        fetchProducts(); // Refresh to get calculated fields like stock/price
        setIsEditProductOpen(false);
        setEditingProduct(null);
      } catch (error) {
        console.error("Error updating product:", error);
      }
    }
  };

  const handleAddProduct = async () => {
    if (!newProductProveedor) {
      toast.error("Debes seleccionar un proveedor para el producto.");
      return;
    }
    try {
      const payload = {
        name: newProductName,
        categoryId: parseInt(newProductCategory),
        proveedorId: newProductProveedor ? parseInt(newProductProveedor) : null,
        presentacion: newProductPresentacion,
        imagen: newProductImagen || null,
      };
      await api.post("/catalogo/productos/", payload);
      fetchProducts();
      fetchCategories(); // Update product counts
      setIsAddProductOpen(false);
      setNewProductName("Refresco Cola");
      setNewProductCategory("2");
      setNewProductProveedor("");
      setNewProductPresentacion("");
      setNewProductImagen("");
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCategoryError(null);
    try {
      const payload = {
        name: newCategoryName,
        profitPercentage: parseFloat(newCategoryProfit) || 3,
      };
      await api.post("/catalogo/categorias/", payload);
      fetchCategories();
      setIsAddCategoryOpen(false);
      setNewCategoryName("");
      setNewCategoryProfit("3");
      setCategoryError(null);
    } catch (err: any) {
      // El backend retorna { name: ["mensaje"] } en errores de campo (DRF field-level)
      const msg =
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.detail ||
        "Error al crear la categoría. Intenta de nuevo.";
      setCategoryError(msg);
    }
  };

  const handleViewCategoryClick = () => {
    if (selectedCategoryData) {
      setViewingCategory(selectedCategoryData);
      setIsViewCategoryOpen(true);
    }
  };

  const handleEditCategoryClick = () => {
    if (selectedCategoryData) {
      setEditingCategory(selectedCategoryData);
      setIsEditCategoryOpen(true);
    }
  };

  const handleDeleteCategoryClick = () => {
    if (selectedCategoryData) {
      setDeleteCategoryAlert({
        isOpen: true,
        categoryId: selectedCategoryData.id,
        categoryName: selectedCategoryData.name,
        hasProducts: selectedCategoryData.productCount > 0,
      });
    }
  };

  const handleSaveEditCategory = async () => {
    if (!editingCategory) return;
    setEditCategoryError(null);
    try {
      const payload = {
        name: editingCategory.name,
        profitPercentage: parseFloat(editingCategory.profitPercentage) || 3,
      };
      await api.patch(`/catalogo/categorias/${editingCategory.id}/`, payload);
      fetchCategories();
      setIsEditCategoryOpen(false);
      setEditingCategory(null);
      setEditCategoryError(null);
    } catch (err: any) {
      // El backend retorna { name: ["mensaje"] } en errores de campo (DRF field-level)
      const msg =
        err?.response?.data?.name?.[0] ||
        err?.response?.data?.detail ||
        "Error al editar la categoría. Intenta de nuevo.";
      setEditCategoryError(msg);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (deleteCategoryAlert.categoryId) {
      try {
        await api.delete(
          `/catalogo/categorias/${deleteCategoryAlert.categoryId}/`,
        );
        setCategories(
          categories.filter((cat) => cat.id !== deleteCategoryAlert.categoryId),
        );
        setDeleteCategoryAlert({
          isOpen: false,
          categoryId: null,
          categoryName: "",
          hasProducts: false,
        });
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      } catch (error) {
        console.error("Error deleting category:", error);
      }
    }
  };

  const searchedProducts = filteredProducts.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Productos</h1>
          <p className="text-muted-foreground">
            Gestiona tu catálogo de productos
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsAddCategoryOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-md dark:from-blue-500 dark:to-blue-700"
          >
            <Plus className="size-4 mr-2" />
            Agregar Categoría
          </Button>
          <Button
            onClick={() => setIsAddProductOpen(true)}
            className="bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white shadow-md dark:from-slate-500 dark:to-slate-700"
          >
            <Plus className="size-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Mensaje de éxito */}
      {successMessage && (
        <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center">
              <Check className="size-6 text-white" />
            </div>
            <p className="font-semibold text-green-800">
              Producto eliminado con éxito
            </p>
          </div>
        </Card>
      )}

      {/* Vista de categorías o tabla de productos */}
      {selectedCategory === null ? (
        <div>
          <Card className="p-6 mb-6 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">Categorías</h2>
              <div className="relative flex-1 max-w-md ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Buscar categorías..."
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((category) => (
                <Card
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    window.history.pushState({}, "");
                  }}
                  className="p-6 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-slate-300 group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="size-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Package className="size-6 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-gradient-to-r from-slate-100 to-gray-200 text-slate-800 rounded-full text-sm font-bold">
                      {category.productCount}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "producto" : "productos"}
                  </p>
                </Card>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground">
                No se encontraron categorías
              </p>
            )}
          </div>
        </div>
      ) : (
        <Card className="p-6 border-0 shadow-lg">
          {/* Header de la categoría */}

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-2xl"
                onClick={() => {
                  setSelectedCategory(null);
                }}
              >
                <ArrowLeft className="size-5" />
              </Button>

              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {selectedCategoryData?.name}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {filteredProducts.length} productos en esta categoría
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewCategoryClick}
              >
                <Eye className="size-4" />
              </Button>

              <Button variant="outline" onClick={handleEditCategoryClick}>
                <Pencil className="size-4 mr-2" />
              </Button>

              <Button
                variant="outline"
                onClick={handleDeleteCategoryClick}
                className="bg-card border-red-500 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="size-4 mr-2" />
              </Button>
            </div>
          </div>

          {/* Buscador de productos */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
              <Input
                placeholder="Buscar productos por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del Producto</TableHead>
                  <TableHead>Presentación</TableHead>
                  <TableHead>Stock Disponible</TableHead>
                  <TableHead>Precio de Venta</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchedProducts.length > 0 ? (
                  searchedProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted">
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-3">
                          {product.imagen ? (
                            <img
                              src={product.imagen}
                              alt={product.name}
                              className="size-10 rounded-lg object-cover border shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="size-5" />
                            </div>
                          )}
                          <span>{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {product.presentacion || "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            product.stock === 0
                              ? "bg-red-100 text-red-700"
                              : product.stock < 10
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {product.stock}{" "}
                          {product.stock === 1 ? "unidad" : "unidades"}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">
                        C${Math.ceil(product.salePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(product)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron productos que coincidan con "
                      {searchTerm}"
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Modal: Agregar Producto */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Agregar Producto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground font-semibold">
                Nombre del Producto
              </Label>
              <Input
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="Ej: Refresco Cola"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">Categoría</Label>
              <Select
                value={newProductCategory}
                onValueChange={setNewProductCategory}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground font-semibold">Proveedor</Label>
              <Select
                value={newProductProveedor}
                onValueChange={setNewProductProveedor}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((prov) => (
                    <SelectItem key={prov.id} value={prov.id.toString()}>
                      {prov.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Tamaño / Presentación (Opcional)
              </Label>
              <Input
                value={newProductPresentacion}
                onChange={(e) => setNewProductPresentacion(e.target.value)}
                placeholder="Ej: 12 onzas, 3 litros, 500 ml"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Foto del Producto (Opcional)
              </Label>
              <div className="mt-2 flex items-center gap-4">
                {newProductImagen ? (
                  <div className="relative size-16 rounded-lg overflow-hidden border shrink-0">
                    <img
                      src={newProductImagen}
                      alt="Vista previa"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setNewProductImagen("")}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 hover:bg-red-600 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <div className="size-16 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground text-xs shrink-0">
                    Sin foto
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, false)}
                  className="flex-1 cursor-pointer"
                />
              </div>
            </div>
            <Button
              onClick={handleAddProduct}
              className="w-full bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white shadow-md dark:from-slate-500 dark:to-slate-700"
            >
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Agregar Categoría */}
      <Dialog
        open={isAddCategoryOpen}
        onOpenChange={(open) => {
          setIsAddCategoryOpen(open);
          if (!open) setCategoryError(null); // Limpiar error al cerrar
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Agregar Categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground font-semibold">
                Nombre de la Categoría
              </Label>
              <Input
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (categoryError) setCategoryError(null); // Limpiar al escribir
                }}
                placeholder="Ej: Bebidas"
                className={`mt-2 ${categoryError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Porcentaje de Ganancia
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  step="0.1"
                  value={newCategoryProfit}
                  onChange={(e) => setNewCategoryProfit(e.target.value)}
                  placeholder="3"
                  className="flex-1"
                />
                <span className="text-foreground font-semibold text-lg">%</span>
              </div>
            </div>

            {/* Error inline: se muestra solo cuando el backend rechaza la petición */}
            {categoryError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <Button
              onClick={handleAddCategory}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white shadow-md dark:from-blue-500 dark:to-blue-700"
            >
              Aceptar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Producto */}
      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Editar Producto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground font-semibold">
                Nombre del Producto
              </Label>
              <Input
                value={editingProduct?.name || ""}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                placeholder="Nombre del producto"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">Categoría</Label>
              <Select
                value={editingProduct?.categoryId?.toString() || ""}
                onValueChange={(value) =>
                  setEditingProduct({ ...editingProduct, categoryId: value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Proveedor (Opcional)
              </Label>
              <Select
                value={editingProduct?.proveedorId?.toString() || ""}
                onValueChange={(value) =>
                  setEditingProduct({ ...editingProduct, proveedorId: value })
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {proveedores.map((prov) => (
                    <SelectItem key={prov.id} value={prov.id.toString()}>
                      {prov.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Tamaño / Presentación (Opcional)
              </Label>
              <Input
                value={editingProduct?.presentacion || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    presentacion: e.target.value,
                  })
                }
                placeholder="Ej: 12 onzas, 3 litros, 500 ml"
                className="mt-2"
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Foto del Producto (Opcional)
              </Label>
              <div className="mt-2 flex items-center gap-4">
                {editingProduct?.imagen ? (
                  <div className="relative size-16 rounded-lg overflow-hidden border shrink-0">
                    <img
                      src={editingProduct.imagen}
                      alt="Vista previa"
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...editingProduct, imagen: null })}
                      className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5 hover:bg-red-600 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ) : (
                  <div className="size-16 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground text-xs shrink-0">
                    Sin foto
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, true)}
                  className="flex-1 cursor-pointer"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveEdit}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Categoría */}
      <Dialog open={isViewCategoryOpen} onOpenChange={setIsViewCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Categoría
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground font-semibold">
                Nombre de la Categoría
              </Label>
              <p className="mt-2 text-foreground">{viewingCategory?.name}</p>
            </div>

            <div>
              <Label className="text-foreground font-semibold">
                Porcentaje de Ganancia
              </Label>
              <p className="mt-2 text-foreground">
                {viewingCategory?.profitPercentage}%
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Categoría */}
      <Dialog
        open={isEditCategoryOpen}
        onOpenChange={(open) => {
          setIsEditCategoryOpen(open);
          if (!open) setEditCategoryError(null); // Limpiar error al cerrar
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Editar Categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-foreground font-semibold">
                Nombre de la Categoría
              </Label>
              <Input
                value={editingCategory?.name || ""}
                onChange={(e) => {
                  setEditingCategory({
                    ...editingCategory,
                    name: e.target.value,
                  });
                  if (editCategoryError) setEditCategoryError(null); // Limpiar al escribir
                }}
                placeholder="Nombre de la categoría"
                className={`mt-2 ${editCategoryError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
            </div>
            <div>
              <Label className="text-foreground font-semibold">
                Porcentaje de Ganancia
              </Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  step="0.1"
                  value={editingCategory?.profitPercentage || "3"}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
                      profitPercentage: e.target.value,
                    })
                  }
                  placeholder="3"
                  className="flex-1"
                />
                <span className="text-foreground font-semibold text-lg">%</span>
              </div>
            </div>

            {/* Error inline: se muestra cuando el nombre ya existe en la BD */}
            {editCategoryError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{editCategoryError}</span>
              </div>
            )}

            <Button
              onClick={handleSaveEditCategory}
              className="w-full bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
            >
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* AlertDialog: Eliminar Producto */}
      <AlertDialog
        open={deleteAlert.isOpen}
        onOpenChange={(open) =>
          !open && setDeleteAlert({ ...deleteAlert, isOpen: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">
              {deleteAlert.hasStock ? "No se puede eliminar" : "¿Está seguro?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {deleteAlert.hasStock
                ? "Este producto no se puede eliminar porque tiene existencia en stock."
                : `¿Está seguro de que desea eliminar el producto "${deleteAlert.productName}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteAlert.hasStock ? (
              <AlertDialogAction
                onClick={() =>
                  setDeleteAlert({ ...deleteAlert, isOpen: false })
                }
                className="bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white shadow-md dark:from-slate-500 dark:to-slate-700"
              >
                Entendido
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-0">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
                >
                  Sí, eliminar
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Eliminar Categoría */}
      <AlertDialog
        open={deleteCategoryAlert.isOpen}
        onOpenChange={(open) =>
          !open &&
          setDeleteCategoryAlert({ ...deleteCategoryAlert, isOpen: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-foreground">
              {deleteCategoryAlert.hasProducts
                ? "No se puede eliminar"
                : "¿Está seguro?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {deleteCategoryAlert.hasProducts
                ? "Esta categoría no se puede eliminar porque contiene productos."
                : `¿Está seguro de que desea eliminar esta categoría?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deleteCategoryAlert.hasProducts ? (
              <AlertDialogAction
                onClick={() =>
                  setDeleteCategoryAlert({
                    ...deleteCategoryAlert,
                    isOpen: false,
                  })
                }
                className="bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-500 dark:to-slate-700 hover:from-slate-800 hover:to-slate-950"
              >
                Entendido
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel className="bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white border-0">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDeleteCategory}
                  className="bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
                >
                  Sí
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
