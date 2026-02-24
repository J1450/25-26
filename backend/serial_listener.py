import tkinter as tk
import serial
import serial.tools.list_ports

class ArduinoController:
    def __init__(self, root):
        self.root = root
        self.root.title("Arduino Controller")
        self.root.geometry("300x320")
        
        self.arduino = None
        
        # Status label
        self.status_label = tk.Label(root, text="Connecting...", fg="blue", font=("Arial", 10))
        self.status_label.pack(pady=10)
        
        # Now connect to Arduino
        self.connect_arduino()
        
        # Create buttons
        btnIsAs = tk.Button(root, text="isAsystole", command=lambda: self.send_command("isAsystole"),
                        width=20, height=2, font=("Arial", 12))
        btnIsAs.pack(pady=10)
        
        btnIsVe = tk.Button(root, text="isVentFibe", command=lambda: self.send_command("isVentFib"),
                        width=20, height=2, font=("Arial", 12))
        btnIsVe.pack(pady=10)
   	 
        btnisNS = tk.Button(root, text="isNormalSi", command=lambda: self.send_command("isNormS"),
                        width=20, height=2, font=("Arial", 12))
        btnisNS.pack(pady=10)
        btnisIn = tk.Button(root, text="isInveCh", command=lambda: self.send_command("isInveCh\n"),
                        width=20, height=2, font=("Arial", 12))
        btnisIn.pack(pady=10)

    def connect_arduino(self):
        """Automatically find and connect to Arduino"""
        ports = serial.tools.list_ports.comports()
        for port in ports:
            # Look for Arduino in port description
            if 'Arduino' in port.description or 'CH340' in port.description or 'USB' in port.description:
                try:
                    self.arduino = serial.Serial(port.device, 9600, timeout=1)
                    self.status_label.config(text=f"Connected to {port.device}", fg="green")
                    return
                except:
                    pass
        
        self.status_label.config(text="Arduino not found! Check connection.", fg="red")
    
    def send_command(self, command):
        """Send command to Arduino"""
        if self.arduino and self.arduino.is_open:
            self.arduino.write(f"{command}\n".encode())
            self.status_label.config(text=f"Sent: {command}", fg="green")
        else:
            self.status_label.config(text="Not connected to Arduino!", fg="red")
    
    def __del__(self):
        if self.arduino:
            self.arduino.close()

if __name__ == "__main__":
    root = tk.Tk()
    app = ArduinoController(root)
    root.mainloop()