"use client"; // This page will involve client-side interaction for the form

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateReorderAlert, type GenerateReorderAlertInput, type GenerateReorderAlertOutput } from "@/ai/flows/generate-reorder-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AlertsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [alertResult, setAlertResult] = useState<GenerateReorderAlertOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<GenerateReorderAlertInput>({
    productName: "",
    currentStockLevel: 0,
    historicalSalesData: "",
    reorderThreshold: 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "currentStockLevel" || name === "reorderThreshold" ? Number(value) : value,
    }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setAlertResult(null);
    setError(null);
    try {
      const result = await generateReorderAlert(formData);
      setAlertResult(result);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Stock Reorder Alerts</h1>
      
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Generate Reorder Alert</CardTitle>
          <CardDescription>
            Use AI to analyze product data and determine if a reorder is needed.
            Fill in the details below to get a recommendation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="productName">Product Name</Label>
              <Input 
                id="productName" 
                name="productName" 
                value={formData.productName}
                onChange={handleChange}
                required 
                placeholder="e.g., Premium Hair Oil"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="currentStockLevel">Current Stock Level</Label>
                <Input 
                  id="currentStockLevel" 
                  name="currentStockLevel" 
                  type="number" 
                  value={formData.currentStockLevel}
                  onChange={handleChange}
                  required 
                  placeholder="e.g., 50"
                />
              </div>
              <div>
                <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
                <Input 
                  id="reorderThreshold" 
                  name="reorderThreshold" 
                  type="number" 
                  value={formData.reorderThreshold}
                  onChange={handleChange}
                  required 
                  placeholder="e.g., 20"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="historicalSalesData">Historical Sales Data</Label>
              <Textarea 
                id="historicalSalesData" 
                name="historicalSalesData"
                value={formData.historicalSalesData}
                onChange={handleChange} 
                required 
                placeholder="e.g., Sold 10 units last week, 15 units the week before. Average 50 units/month."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide a summary of recent sales trends for this product.
              </p>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate Alert
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {alertResult && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center">
              {alertResult.shouldReorder ? 
                <CheckCircle className="h-6 w-6 mr-2 text-green-500" /> : 
                <XCircle className="h-6 w-6 mr-2 text-red-500" /> 
              }
              Reorder Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-semibold text-lg">
              {alertResult.shouldReorder 
                ? `Recommendation: Reorder ${alertResult.reorderQuantity} units.`
                : "Recommendation: No immediate reorder needed."}
            </p>
            <div>
              <h4 className="font-medium">Reason:</h4>
              <p className="text-muted-foreground">{alertResult.reason}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle>Automated Low Stock Alerts</CardTitle>
            <CardDescription>This section will display products that are automatically flagged as needing reorder based on predefined thresholds and sales velocity (feature to be implemented).</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Automated low stock alerts list placeholder.</p>
            {/* TODO: Implement a list of automatically detected low stock items */}
        </CardContent>
      </Card>

    </div>
  );
}
